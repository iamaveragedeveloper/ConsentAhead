// One-command deploy to your own AWS account. Needs only Node and the AWS CLI.
//   aws configure                    (once, with an IAM user's keys)
//   node infra/deploy.mjs            build + deploy the API, cache table and website
//   node infra/deploy.mjs --destroy  delete everything this created (stops all charges)
//
// Region defaults to us-east-1 (where the Bedrock model is available). Override with AWS_REGION.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const stack = process.env.STACK_NAME || "data-firewall";

function aws(args, { quiet = false, allowFail = false } = {}) {
  const r = spawnSync("aws", [...args, "--region", region], { encoding: "utf8", cwd: root });
  if (r.error) {
    console.error("\nCould not run the AWS CLI. Install it from https://aws.amazon.com/cli/ and run `aws configure`.");
    process.exit(1);
  }
  if (r.status !== 0 && !allowFail) {
    console.error(`\naws ${args.slice(0, 2).join(" ")} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  if (!quiet && r.stdout && r.status === 0 && args[0] === "cloudformation" && args[1] === "deploy") console.log(r.stdout.trim());
  return r;
}
const node = (script) => {
  const r = spawnSync(process.execPath, [path.join(root, "infra", script)], { stdio: "inherit", cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// 1. Who am I deploying as?
const who = aws(["sts", "get-caller-identity", "--output", "json"], { quiet: true, allowFail: true });
if (who.status !== 0) {
  console.error("No AWS credentials found. Run `aws configure` with an IAM user's access keys, then try again.");
  process.exit(1);
}
const account = JSON.parse(who.stdout).Account;
console.log(`Account ${account}, region ${region}, stack "${stack}"`);

const outputs = () => {
  const r = aws(["cloudformation", "describe-stacks", "--stack-name", stack, "--query", "Stacks[0].Outputs", "--output", "json"], { quiet: true, allowFail: true });
  if (r.status !== 0) return null;
  return Object.fromEntries(JSON.parse(r.stdout).map((o) => [o.OutputKey, o.OutputValue]));
};

// 0. Tear everything down
if (process.argv.includes("--destroy")) {
  const o = outputs();
  if (!o) { console.log("Nothing to delete."); process.exit(0); }
  console.log("Emptying the website bucket and deleting the stack...");
  aws(["s3", "rm", `s3://${o.SiteBucketName}`, "--recursive"], { quiet: true, allowFail: true });
  aws(["cloudformation", "delete-stack", "--stack-name", stack], { quiet: true });
  aws(["cloudformation", "wait", "stack-delete-complete", "--stack-name", stack], { quiet: true });
  console.log("Deleted. (The small deploy bucket consentahead-deploy-* can be removed in the S3 console if you like.)");
  process.exit(0);
}

// 2. Build
console.log("\nBuilding the API...");
node("build-lambda.mjs");
console.log("Building the website...");
node("build-site.mjs");

// 3. Package + deploy
const deployBucket = `consentahead-deploy-${account}-${region}`;
if (aws(["s3api", "head-bucket", "--bucket", deployBucket], { quiet: true, allowFail: true }).status !== 0) {
  console.log(`\nCreating deploy bucket ${deployBucket}...`);
  aws(["s3", "mb", `s3://${deployBucket}`], { quiet: true });
}
console.log("\nPackaging...");
aws(["cloudformation", "package", "--template-file", "infra/template.yaml", "--s3-bucket", deployBucket, "--output-template-file", "infra/.packaged.yaml"], { quiet: true });
console.log("Deploying (the first time takes about 5 minutes, mostly CloudFront)...");
aws(["cloudformation", "deploy", "--template-file", "infra/.packaged.yaml", "--stack-name", stack, "--capabilities", "CAPABILITY_IAM", "--no-fail-on-empty-changeset"]);

// 4. Publish the website
const o = outputs();
if (!o) { console.error("Deployed, but could not read the stack outputs."); process.exit(1); }
console.log("\nUploading the website...");
aws(["s3", "sync", "site-dist", `s3://${o.SiteBucketName}`, "--delete"], { quiet: true });
aws(["cloudfront", "create-invalidation", "--distribution-id", o.SiteDistributionId, "--paths", "/*"], { quiet: true, allowFail: true });

console.log(`
Done.

  Website (privacy, terms, demo):  ${o.SiteUrl}
  Privacy policy link for the store: ${o.SiteUrl}/privacy.html
  API:                             ${o.ApiEndpoint}
  Health check:                    ${o.ApiEndpoint}/health

To make the extension use the API, build it with:
  VITE_API_BASE_URL=${o.ApiEndpoint}
`);

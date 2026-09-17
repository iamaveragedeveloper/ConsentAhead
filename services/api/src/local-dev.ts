// Local Dev Server — runs all API handlers via http for local testing
import http from "http";
import { handler as healthHandler } from "./handlers/health";
import { handler as formAnalyzeHandler } from "./handlers/formAnalyze";
import { handler as policyDiscoverHandler } from "./handlers/policyDiscover";
import { handler as policyAnalyzeHandler } from "./handlers/policyAnalyze";
import { handler as companyPathwaysHandler } from "./handlers/companyPathways";

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let bodyStr = "";
  req.on("data", (chunk) => {
    bodyStr += chunk;
  });

  req.on("end", async () => {
    const url = req.url || "/";
    let lambdaEvent = { body: bodyStr };
    let result: { statusCode: number; headers?: Record<string, string>; body: string };

    try {
      if (url === "/health" || url === "/") {
        result = await healthHandler();
      } else if (url === "/form/analyze") {
        result = await formAnalyzeHandler(lambdaEvent);
      } else if (url === "/policy/discover") {
        result = await policyDiscoverHandler(lambdaEvent);
      } else if (url === "/policy/analyze") {
        result = await policyAnalyzeHandler(lambdaEvent);
      } else if (url === "/company/pathways") {
        result = await companyPathwaysHandler(lambdaEvent);
      } else {
        result = {
          statusCode: 404,
          body: JSON.stringify({ error: "Endpoint not found" }),
        };
      }
    } catch (e) {
      result = {
        statusCode: 500,
        body: JSON.stringify({ error: (e as Error).message }),
      };
    }

    res.writeHead(result.statusCode, {
      "Content-Type": "application/json",
      ...(result.headers || {}),
    });
    res.end(result.body);
  });
});

server.listen(PORT, () => {
  console.log(`[ConsentAhead Local API] Server running on http://localhost:${PORT}`);
  console.log(`Endpoints available:`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  POST http://localhost:${PORT}/form/analyze`);
  console.log(`  POST http://localhost:${PORT}/policy/discover`);
  console.log(`  POST http://localhost:${PORT}/policy/analyze`);
  console.log(`  POST http://localhost:${PORT}/company/pathways`);
});

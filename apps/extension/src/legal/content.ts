// Single source for the extension's Privacy Policy and Terms of Use.
// Rendered inside the extension (dashboard → Privacy policy / Terms of use) and exported to
// PRIVACY.md / TERMS.md at the repo root by `pnpm legal:md`, so the copies cannot drift apart.
//
// Everything here describes what the extension actually does. If behaviour changes (for example
// the optional cloud backend is switched on), update the text and EFFECTIVE_DATE in the same commit.

export interface Section {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  id: "privacy" | "terms";
  title: string;
  intro: string;
  sections: Section[];
}

export const EFFECTIVE_DATE = "19 September 2026";

// Fill these in before publishing (see the note at the end of this file).
export const DEVELOPER = "the Data Firewall developers";
export const CONTACT = "[add a contact email address]";
export const GOVERNING_LAW = "[add your country or state]";

export const PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  intro:
    "Data Firewall is a browser extension that shows what a website asks for, reads what its privacy policy says, and fills forms from details you keep on your own device. This policy explains what the extension does with information. The short version: it works on your device, and it does not send your personal information to us or to anyone else.",
  sections: [
    {
      heading: "In short",
      bullets: [
        "Your details stay on your device, encrypted. We never receive them.",
        "No accounts, no analytics, no tracking, no advertising, and we never sell data.",
        "Nothing is scanned on a site until you open the extension there (from the shield beside a field, or the toolbar icon) and allow access to that site.",
        "You can view, export or delete everything the extension stores, at any time.",
      ],
    },
    {
      heading: "Information stored on your device",
      paragraphs: ["The extension keeps the following in your browser's local storage. None of it leaves your device."],
      bullets: [
        "Your vault: the details you choose to enter (name, email, phone, date of birth, job title, company and address). It is stored encrypted with AES-GCM. The encryption key is kept in the extension's own storage on the same device.",
        "Your activity: for each form you fill, the site's domain, the time, the categories of data shared (for example “Contact”), how sensitive each was, and whether you filled required fields only. It never records the values you filled in.",
        "Your company list: sites you have used the extension on, their policy links, and any deletion or data-request links you add yourself.",
        "Privacy-scan results: the findings and short quotes taken from a site's public privacy policy or terms, kept for up to 24 hours so a repeat visit is instant.",
        "A temporary note of the address of the tab where you pressed the shield, kept in the browser's session storage and cleared when the browser closes.",
      ],
    },
    {
      heading: "What the extension reads on web pages",
      bullets: [
        "Before you allow a site: a very small script runs on pages you visit. It only notices that you clicked into a text field so it can show the shield beside it. It reads no labels, values or page text, and sends nothing anywhere.",
        "After you allow a site: the extension reads the names, labels and types of the form fields on that page, and links to the site's privacy policy and terms.",
        "It never reads what you have typed into a field, never touches password fields, fills a form only when you press Fill, and never submits a form.",
      ],
    },
    {
      heading: "The privacy scan",
      paragraphs: [
        "To show how a site says it will use your details, the extension downloads that site's privacy policy and terms and analyses the text on your device. The download is a normal request to the site, just like opening the page yourself, so the site can see it, including your IP address, as it can with any visit. None of your vault details are included in these requests.",
        "If a page has no policy link, the extension may try a few common addresses on the same site, such as /privacy and /terms.",
      ],
    },
    {
      heading: "What we collect and share",
      paragraphs: [
        "Nothing. The extension has no accounts, no analytics or telemetry, no advertising and no third-party trackers. The developers do not receive your vault, your activity or your browsing information, and we do not sell or share it.",
      ],
    },
    {
      heading: "Optional cloud analysis",
      paragraphs: [
        "The project includes an optional cloud service (built on AWS) for AI-assisted policy analysis. It is switched off in this version and the extension works fully without it. If it is ever enabled, it would receive only the type and label of the form fields and the address of the policy, never your vault details, and this policy would be updated before that happens.",
      ],
    },
    {
      heading: "Why the extension needs its permissions",
      bullets: [
        "Storage: to keep your vault, activity and settings on your device.",
        "Active tab and scripting: to read the form on the page you are looking at, and to fill it when you press Fill.",
        "Access to sites (optional): requested one site at a time, only when you allow it. You can remove it at any time in the dashboard under Data & access.",
        "A script on all web pages: only to show the shield beside a text field when you click into it, as described above.",
      ],
    },
    {
      heading: "Your choices",
      bullets: [
        "Edit or clear your vault at any time in the dashboard.",
        "Delete individual records, or forget a company, in Activity and Companies.",
        "Remove access for any site in Data & access, or from the popup.",
        "Export your activity as a JSON file. The export never includes your vault.",
        "Delete all data in one step. Uninstalling the extension also removes everything it stored.",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "Your vault is encrypted, and the extension never sends it anywhere. The encryption key is kept on the same device, so the vault protects your details from casual access rather than from someone who can already use your unlocked browser profile. Do not store details in the vault on a shared or untrusted computer, and keep your device and browser account secure.",
      ],
    },
    {
      heading: "Children",
      paragraphs: ["Data Firewall is not directed at children under 13, and we do not knowingly collect information from them."],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If the extension's behaviour changes in a way that affects your information, we will update this page and its effective date, and where it matters we will ask you again before anything new happens.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about this policy can be sent to ${CONTACT}.`],
    },
  ],
};

export const TERMS: LegalDoc = {
  id: "terms",
  title: "Terms of Use",
  intro:
    "These terms apply to your use of the Data Firewall browser extension. By installing or using it, you agree to them. If you do not agree, please uninstall the extension.",
  sections: [
    {
      heading: "What Data Firewall is",
      paragraphs: [
        "Data Firewall helps you see what information a website requests, summarises what the site's own privacy policy and terms say about it, and fills forms from details you save on your device. It is an assistant. You stay in control: it fills a form only when you ask, and it never submits one for you.",
      ],
    },
    {
      heading: "Not legal advice",
      paragraphs: [
        "The privacy scan is generated automatically from the text of a site's policy. It can miss things, misread wording or be out of date, and it does not say whether a company follows the law. Please read the original policy for anything important; the extension links to the exact sentence it quotes. Nothing in the extension is legal, financial or professional advice.",
      ],
    },
    {
      heading: "Your responsibilities",
      bullets: [
        "Review a form before you submit it. You are responsible for what you choose to send to a website.",
        "Save only your own details, or details you are allowed to use.",
        "Use the extension lawfully and in line with the terms of the websites you visit.",
        "Keep your device and browser secure. You are responsible for who can use them.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: ["You agree not to use the extension to:"],
      bullets: [
        "collect other people's personal information, or fill forms with details that are not yours;",
        "send spam, commit fraud, or break the law or a website's rules;",
        "interfere with or attack a website or service, or work around its security.",
      ],
    },
    {
      heading: "Third-party websites and content",
      paragraphs: [
        "Privacy policies, terms and forms belong to the websites that publish them. The extension shows short quotations from them only to help you understand them. We do not control those sites and are not responsible for their content or practices.",
      ],
    },
    {
      heading: "Your data",
      paragraphs: ["How your information is handled is described in the Privacy Policy, which forms part of these terms."],
    },
    {
      heading: "Software licence",
      paragraphs: [
        "The extension's source code is published under the MIT Licence, as stated in the project repository. These terms cover your use of the extension itself.",
      ],
    },
    {
      heading: "No warranty",
      paragraphs: [
        "The extension is provided “as is” and “as available”, without warranties of any kind, whether express or implied. We do not promise that it will be error-free, that it will fill every form correctly, or that its analysis of any policy is complete or accurate.",
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        `To the fullest extent the law allows, ${DEVELOPER} are not liable for any indirect, incidental or consequential loss, or for loss of data or profits, arising from your use of the extension. Nothing in these terms limits liability that cannot be limited by law.`,
      ],
    },
    {
      heading: "Changes and ending your use",
      paragraphs: [
        "We may update these terms as the extension changes; the current version and its effective date are shown on this page. Continuing to use the extension after an update means you accept it. You can stop at any time by uninstalling the extension, which removes the data it stored.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [`These terms are governed by the laws of ${GOVERNING_LAW}.`],
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about these terms can be sent to ${CONTACT}.`],
    },
  ],
};

export const LEGAL_DOCS = { privacy: PRIVACY, terms: TERMS } as const;

// Before publishing: replace CONTACT, DEVELOPER and GOVERNING_LAW above, add a LICENSE file (the
// terms refer to the MIT Licence), and have the text reviewed by a lawyer for your jurisdiction.
// This is a good-faith description of the extension's behaviour, not legal advice.

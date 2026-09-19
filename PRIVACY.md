# Data Firewall Privacy Policy

_Effective 19 September 2026 · Version 1.1.0_

Data Firewall is a browser extension that shows what a website asks for, reads what its privacy policy says, and fills forms from details you keep on your own device. This policy explains what the extension does with information. The short version: it works on your device, and it does not send your personal information to us or to anyone else.

## 1. In short

- Your details stay on your device, encrypted. We never receive them.
- No online accounts, no analytics, no tracking, no advertising, and we never sell data. Accounts are local, exist only on your device, and each one has its own separate vault.
- Nothing is scanned on a site until you open the extension there (from the shield beside a field, or the toolbar icon) and allow access to that site.
- You can view, export or delete everything the extension stores, at any time.

## 2. Information stored on your device

The extension keeps the following in your browser's local storage. None of it leaves your device.

- Your local accounts: for each account on this device, the name and email it was created with, and a salted, one-way hash of its password (never the password itself). They are used only to unlock the extension on this device and are not sent anywhere. Each account has its own separate vault, activity and company list.
- Your vault: the details you choose to enter (name, email, phone, date of birth, job title, company and address). It is stored encrypted with AES-GCM. The encryption key is kept in the extension's own storage on the same device.
- Your activity: for each form you fill, the site's domain, the time, the categories of data shared (for example “Contact”), how sensitive each was, and whether you filled required fields only. It never records the values you filled in.
- Your company list: sites you have used the extension on, their policy links, and any deletion or data-request links you add yourself.
- Privacy-scan results: the findings and short quotes taken from a site's public privacy policy or terms, kept for up to 24 hours so a repeat visit is instant.
- A temporary note of the address of the tab where you pressed the shield, kept in the browser's session storage and cleared when the browser closes.

## 3. What the extension reads on web pages

- Before you allow a site: a very small script runs on pages you visit. It only notices that you clicked into a text field so it can show the shield beside it. It reads no labels, values or page text, and sends nothing anywhere.
- After you allow a site: the extension reads the names, labels and types of the form fields on that page, and links to the site's privacy policy and terms.
- It never reads what you have typed into a field, never touches password fields, fills a form only when you press Fill, and never submits a form.

## 4. The privacy scan

To show how a site says it will use your details, the extension downloads that site's privacy policy and terms and analyses the text on your device. The download is a normal request to the site, just like opening the page yourself, so the site can see it, including your IP address, as it can with any visit. None of your vault details are included in these requests.

If a page has no policy link, the extension may try a few common addresses on the same site, such as /privacy and /terms.

## 5. What we collect and share

Nothing. The extension has no online accounts, no analytics or telemetry, no advertising and no third-party trackers. Your sign-in never leaves your device. The developers do not receive your vault, your activity or your browsing information, and we do not sell or share it.

## 6. Optional cloud analysis

The project includes an optional cloud service (built on AWS) for AI-assisted policy analysis. It is switched off in this version and the extension works fully without it. If it is ever enabled, it would receive only the type and label of the form fields and the address of the policy, never your vault details, and this policy would be updated before that happens.

## 7. Why the extension needs its permissions

- Storage: to keep your vault, activity and settings on your device.
- Active tab and scripting: to read the form on the page you are looking at, and to fill it when you press Fill.
- Access to sites (optional): requested one site at a time, only when you allow it. You can remove it at any time in the dashboard under Data & access.
- A script on all web pages: only to show the shield beside a text field when you click into it, as described above.

## 8. Your choices

- Edit or clear your vault at any time in the dashboard.
- Delete individual records, or forget a company, in Activity and Companies.
- Remove access for any site in Data & access, or from the popup.
- Export your activity as a JSON file. The export never includes your vault.
- Sign out at any time. If you forget a password there is no recovery, because nothing is stored online, so you can erase that account and everything stored with it from the sign-in page and start over. Other accounts on the device are not affected.
- Delete all data in one step. Uninstalling the extension also removes everything it stored.

## 9. Security

Your vault is encrypted, and the extension never sends it anywhere. The encryption key is kept on the same device, so the vault protects your details from casual access rather than from someone who can already use your unlocked browser profile. Signing in unlocks the extension's screens and does not by itself encrypt the vault, so it is not a substitute for keeping your device secure. Accounts keep people's data apart in the extension's screens; they do not stop someone who can use your browser profile from reading what is stored. Do not store details in the vault on a shared or untrusted computer, and keep your device and browser account secure.

## 10. Children

Data Firewall is not directed at children under 13, and we do not knowingly collect information from them.

## 11. Changes to this policy

If the extension's behaviour changes in a way that affects your information, we will update this page and its effective date, and where it matters we will ask you again before anything new happens.

## 12. Contact

Questions about this policy can be sent to [add a contact email address].

---

Also see the [Terms of Use](TERMS.md).

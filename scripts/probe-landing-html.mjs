import http from "node:http";

const body = await new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port: 3000, path: "/", method: "GET", timeout: 8000 }, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
  });
  req.on("error", reject);
  req.end();
});

const text = body.text.replace(/\s+/g, " ");
console.log(JSON.stringify({
  status: body.status,
  hasLandingCta: /Bắt đầu ngay|Bat dau ngay/.test(text),
  hasHomeWelcome: /Chào mừng trở lại/.test(text),
  hasDashboardShell: /enterprise\/dashboard/.test(text) && /Tạo phòng phỏng vấn/.test(text),
}, null, 2));

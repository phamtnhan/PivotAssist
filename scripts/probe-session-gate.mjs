import http from "node:http";

const paths = [
  "/",
  "/home",
  "/applications",
  "/profiles",
  "/settings",
  "/interview",
  "/admin",
  "/dashboard",
  "/jobs",
  "/enterprise",
  "/enterprise/dashboard",
];

function head(path) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: 3000,
        path,
        method: "GET",
        timeout: 4000,
        headers: { Accept: "text/html", Connection: "close" },
      },
      (res) => {
        res.resume();
        resolve({
          path,
          status: res.statusCode ?? 0,
          location: res.headers.location ?? "",
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ path, status: 0, location: "TIMEOUT" });
    });
    req.on("error", (error) => {
      resolve({ path, status: 0, location: error.message });
    });
    req.end();
  });
}

const rows = [];
for (const path of paths) rows.push(await head(path));
console.log(JSON.stringify(rows, null, 2));

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import flowConfirmation from "./api/flow/confirmation.js";
import createFlowPayment from "./api/flow/create.js";
import getFlowPaymentStatus from "./api/flow/status.js";
import flowReturn from "./api/flow/return.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storefrontDir = path.join(__dirname, "storefront");
const distDir = path.join(__dirname, "dist");
const staticDir =
  process.env.NODE_ENV === "production" && existsSync(distDir) ? distDir : storefrontDir;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.all("/api/flow/create", createFlowPayment);
app.all("/api/flow/status", getFlowPaymentStatus);
app.all("/api/flow/confirmation", flowConfirmation);
app.all("/api/flow/return", flowReturn);

app.use(express.static(staticDir));

app.get(["/admin", "/prueba"], (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Nutrición Pura escuchando en http://0.0.0.0:${port}`);
});

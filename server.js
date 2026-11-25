import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import admin from "./api/admin.js";
import mpCreate from "./api/mercadopago/create.js";
import mpStatus from "./api/mercadopago/status.js";
import mpWebhook from "./api/mercadopago/webhook.js";
import flowConfirmation from "./api/flow/confirmation.js";
import createFlowPayment from "./api/flow/create.js";
import getFlowPaymentStatus from "./api/flow/status.js";
import flowReturn from "./api/flow/return.js";
import addressAutocomplete from "./api/address/autocomplete.js";
import addressVerify from "./api/address/verify.js";

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

app.all("/api/mercadopago/create", mpCreate);
app.all("/api/mercadopago/status", mpStatus);
app.all("/api/mercadopago/webhook", mpWebhook);
app.all("/api/admin", admin);
app.all("/api/flow/create", createFlowPayment);
app.all("/api/flow/status", getFlowPaymentStatus);
app.all("/api/flow/confirmation", flowConfirmation);
app.all("/api/flow/return", flowReturn);
app.all("/api/address/autocomplete", addressAutocomplete);
app.all("/api/address/verify", addressVerify);

app.use(express.static(staticDir));

app.get("/admin", (_req,res)=>res.sendFile(path.join(staticDir,"admin.html")));
app.get("/prueba", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Nutrición Pura escuchando en http://0.0.0.0:${port}`);
});

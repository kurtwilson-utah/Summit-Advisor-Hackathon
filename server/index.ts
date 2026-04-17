import cors from "cors";
import express from "express";
import { env } from "./lib/config";
import { chatRouter } from "./routes/chat";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", chatRouter);

app.listen(Number(env.PORT), () => {
  console.log(`Cyncly Advisor API listening on http://localhost:${env.PORT}`);
});

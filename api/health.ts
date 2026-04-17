import { createGetRoute } from "./_utils.js";

export default createGetRoute(() => ({
  status: 200,
  body: {
    ok: true,
    service: "cyncly-advisor-api"
  }
}));

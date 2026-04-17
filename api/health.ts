import { getHealthResponse } from "../server/http/chatApi.js";
import { createGetRoute } from "./_utils.js";

export default createGetRoute(() => getHealthResponse());

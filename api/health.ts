import { getHealthResponse } from "../server/http/chatApi";
import { createGetRoute } from "./_utils";

export default createGetRoute(() => getHealthResponse());

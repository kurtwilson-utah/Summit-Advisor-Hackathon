import { handleThreadsSync } from "../../server/http/chatApi.js";
import { createPostRoute } from "../_utils.js";

export default createPostRoute(handleThreadsSync);

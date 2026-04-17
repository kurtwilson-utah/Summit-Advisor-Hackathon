import { handleEmailAccess } from "../../server/http/chatApi";
import { createPostRoute } from "../_utils";

export default createPostRoute(handleEmailAccess);

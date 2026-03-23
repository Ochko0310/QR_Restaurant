import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thesisRouter from "./thesis";

const router: IRouter = Router();

router.use(healthRouter);
router.use(thesisRouter);

export default router;

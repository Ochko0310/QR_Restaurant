import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thesisRouter from "./thesis";
import authRouter from "./auth";
import tablesRouter from "./tables";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(thesisRouter);
router.use(authRouter);
router.use(tablesRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(reportsRouter);

export default router;

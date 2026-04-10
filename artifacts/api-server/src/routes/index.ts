import { Router, type IRouter } from "express";
import healthRouter from "./health";
import thesisRouter from "./thesis";
import authRouter from "./auth";
import tablesRouter from "./tables";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import reportsRouter from "./reports";
import uploadRouter from "./upload";
import bannersRouter from "./banners";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import reservationsRouter from "./reservations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(thesisRouter);
router.use(authRouter);
router.use(tablesRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(reportsRouter);
router.use(uploadRouter);
router.use(bannersRouter);
router.use(reviewsRouter);
router.use(settingsRouter);
router.use(reservationsRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import trackingRouter from "./tracking";
import paymentsRouter from "./payments";
import bookingsRouter from "./bookings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tracking", trackingRouter);
router.use("/payments", paymentsRouter);
router.use("/bookings", bookingsRouter);

export default router;

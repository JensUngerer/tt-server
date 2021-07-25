import express, { Request, Response } from 'express';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import App from '../../app';
import sessionTimeEntryController from '../controllers/sessionTimeEntryController';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';

var router = express.Router();

const getSessionTimeEntry = async (req: Request, res: Response) => {
  const sessionIdAsTimeEntryId = req.sessionID;

  const response = await sessionTimeEntryController.getDurationStr(sessionIdAsTimeEntryId, App.mongoDbOperations);

  // DEBUGGING:
  // Logger.instance.info(response);

  const stringifiedResponse = Serialization.serialize(response);

  // DEBUGGING:
  // Logger.instance.info(stringifiedResponse);

  res.send(stringifiedResponse);
};

const getWorkingTime = async (req: Request, res: Response) => {
  const response = await sessionTimeEntryController.getWorkingTimeDurationStr(App.mongoDbOperations);
  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const rootRoute = router.route('/');
rootRoute.get(getSessionTimeEntry);

const workingTimeRoute = router.route(routesConfig.workingTimeSuffix);
workingTimeRoute.get(getWorkingTime);

export default router;

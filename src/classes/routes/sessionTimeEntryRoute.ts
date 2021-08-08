import express, { Request, Response } from 'express';
import { Constants } from '../../../../common/typescript/constants';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import App from '../../app';
import { Logger } from '../../logger';
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
  try {
    const today = new Date();
    const todayInUtc = DurationCalculator.getDayFrom(today);
    const durationResponse = await sessionTimeEntryController.getWorkingTimeByDay(App.mongoDbOperations, todayInUtc);
    const durationStr = durationResponse.toFormat(Constants.contextDurationFormat);
    const serializedResponse = Serialization.serialize(durationStr);
    res.send(serializedResponse);
  } catch (exception) {
    Logger.instance.error(exception);
    const serializedError = Serialization.serialize('');
    res.send(serializedError);
  }
};

const getWeeklyWorkingTime = async (req: Request, res: Response) => {
  const durationResponse = await sessionTimeEntryController.getWorkingTimeByWeek(App.mongoDbOperations);
  if (!durationResponse) {
    res.send('');
    return;
  }
  const durationStr = durationResponse.toFormat(Constants.contextDurationFormat);
  const serializedResponse = Serialization.serialize(durationStr);
  res.send(serializedResponse);
};
const rootRoute = router.route('/');
rootRoute.get(getSessionTimeEntry);

const workingTimeRoute = router.route(routesConfig.workingTimeSuffix);
workingTimeRoute.get(getWorkingTime);

const weeklyWorkingTimeRoute = router.route(routesConfig.weeklyWorkingTimeSuffix);
weeklyWorkingTimeRoute.get(getWeeklyWorkingTime);

export default router;

import express, { Request, Response } from 'express';

import { Constants } from '../../../../common/typescript/constants';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { ITimeEntryBase } from '../../../../common/typescript/iTimeEntry';
import App from '../../app';
import { Logger } from '../../logger';
import sessionTimeEntryController from '../controllers/sessionTimeEntryController';
import { UrlHelpers } from '../helpers/urlHelpers';
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

const getWorkingTimeEntries = async (req: Request, res: Response) => {
  try {
    const url = req.url;
    const urlSplit = url.split('/');
    const rawRequestedDayTimeStamp = urlSplit[urlSplit.length - 1];
    const rawRequestedDay = parseInt(rawRequestedDayTimeStamp);
    const requestedDay = new Date(rawRequestedDay);
    // only terminated (completed) time-entries (with endTime != null)
    const additionalCriteria: { [key: string]: any } = {
    };
    additionalCriteria[routesConfig.endDateProperty] = {
      $ne: null,
    };
    const timeEntryDocs: ITimeEntryBase[] = await sessionTimeEntryController.getWorkingTimeEntriesByDay(App.mongoDbOperations, requestedDay, additionalCriteria);

    const serializedResponse = Serialization.serialize(timeEntryDocs);
    res.send(serializedResponse);
  } catch (getWorkingTimeEntriesException) {
    Logger.instance.error(getWorkingTimeEntriesException);
    res.send('');
  }
};

const patchWorkingTimeEntry = async (req: Request, res: Response) => {
  try {
    const url = req.url;
    const id = UrlHelpers.getIdFromUlr(url);
    const response = await sessionTimeEntryController.patchWorkingTimeEntry(id, req, App.mongoDbOperations);
    const stringifiedResponse = Serialization.serialize(response);
    res.send(stringifiedResponse);
  } catch (exc) {
    Logger.instance.error(exc);
    res.send('');
  }
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

const workingTimeEntriesRoute = router.route(routesConfig.workingTimeEntriesSuffix + '/*');
workingTimeEntriesRoute.get(getWorkingTimeEntries);

const workingTimeEntryPatchRoute = router.route(routesConfig.workingTimeEntriesSuffix + '/*');
workingTimeEntryPatchRoute.patch(patchWorkingTimeEntry);
export default router;

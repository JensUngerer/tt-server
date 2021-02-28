import express, { Request, Response } from 'express';
import { FilterQuery } from 'mongodb';

import { ITimeEntryDocument } from '../../../../common/typescript/mongoDB/iTimeEntryDocument';
import { App } from '../../app';
// @ts-ignore
import routesConfig from './../../../../common/typescript/routes.js';
import timeEntriesController from './../controllers/timeEntriesController';
import { RequestProcessingHelpers } from './../helpers/requestProcessingHelpers';
import { UrlHelpers } from './../helpers/urlHelpers';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { CalculateDurationsByInterval } from '../helpers/calculateDurationsByInterval';
import { ITimeSummary } from '../../../../common/typescript/iTimeSummary';
import { ISummarizedTasks } from './../../../../common/typescript/summarizedData';
import taskController from '../controllers/taskController';
import { IContextLine } from './../../../../common/typescript/iContextLine';

const router = express.Router();

const getNonCommittedDaysHandler = async (req: Request, res: Response) => {
  const isRawBookingBased = UrlHelpers.getProperty(req.url, routesConfig.isBookingBasedPropertyName);
  const isBookingBased = JSON.parse(isRawBookingBased as string);
  let isDisabledProperty;
  if (isBookingBased) {
    isDisabledProperty = routesConfig.isDeletedInClientProperty;
  } else {
    isDisabledProperty = routesConfig.isDisabledInCommit;
  }

  const response = await timeEntriesController.getNonCommittedDays(App.mongoDbOperations, isDisabledProperty);
  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const getViaTaskId = async (req: Request, res: Response) => {
  const taskId = UrlHelpers.getIdFromUlr(req.url);
  const filterQuery: FilterQuery<any> = {};
  filterQuery[routesConfig.endDateProperty] = null;
  filterQuery[routesConfig.taskIdPropertyAsForeignKey] = taskId;
  const response = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const getTimeEntries = async (req: Request, res: Response) => {
  const response = await timeEntriesController.get(req, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

/**
 * 1)
 * HTTP-POST /NodeJS/timeEntries + '/' -> a timeEntries-document will be created
 *
 * @param req
 * @param res
 */
const postTimeEntries = async (req: Request, res: Response) => {
  const response = await timeEntriesController.post(req, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

/**
 * 4)
 * HTTP-PATCH /NodeJS/timeEntries + '/stop' -> a timeEntries-document will be updated
 *
 * a) update the current (single!) document with a new endTime-property
 * b) get the current (single!) document via its timeEntryId
 * c) calculate the entire duration based on current (single!) document
 * d) patch the endTime-property with that value
 *
 * @param req
 * @param res
 */
const patchTimeEntriesStop = async (req: Request, res: Response) => {
  // a)
  await timeEntriesController.patchStop(req, App.mongoDbOperations);

  // DEBUGGING:
  // App.logger.info('patchedEndTime:' + patchedEndTime);

  // DEBUGGING:
  // App.logger.info(JSON.stringify(patchDayResult, null, 4));

  // DEBUGGING:
  // App.logger.error(JSON.stringify(response, null, 4));
  // App.logger.error('writing duration in db');

  //b)
  const filterQuery = RequestProcessingHelpers.getFilerQuery(req);
  const theDocuments: ITimeEntryDocument[] = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);

  if (theDocuments &&
    theDocuments.length === 1) {
    const startTime = theDocuments[0].startTime;
    await timeEntriesController.patchDay(req, App.mongoDbOperations, startTime);
  } else {
    App.logger.error('cannot patch day');
  }

  // DEBUGGING
  // App.logger.error(JSON.stringify(theDocuments, null, 4));
  // App.logger.error('calling the patch-method');

  // c) and d)
  await timeEntriesController.patchTheDurationInTimeEntriesDocument(App.mongoDbOperations, theDocuments, req);

  // DEBUGGING:
  // App.logger.error(JSON.stringify(durationInDbResponse, null, 4));
  const theEndTimeStampPatchedDocuments: ITimeEntryDocument[] = await timeEntriesController.get(req, App.mongoDbOperations, filterQuery);
  if (!theEndTimeStampPatchedDocuments ||
    !theEndTimeStampPatchedDocuments.length ||
    theEndTimeStampPatchedDocuments.length !== 1) {
    App.logger.error('no unique document retrieved for patching timeEntry.endTime');
    res.send('');
    return;
  }
  const thePatchedSingleDoc = theEndTimeStampPatchedDocuments[0];
  const finalPatchResult = await taskController.patchDurationSumMap(thePatchedSingleDoc, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(finalPatchResult);
  res.send(stringifiedResponse);
};

/**
 * 5)
 * HTTP-PATCH /NodeJS/timeEntries + '/delete' -> a timeEntries document is updated (and so marked as isDeletedInClient)
 * @param req
 * @param res
 */
const patchTimeEntriesDelete = async (req: Request, res: Response) => {
  const response = await timeEntriesController.patchDeletedInClient(req, App.mongoDbOperations);

  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const getDurationStr = async (req: Request, res: Response) => {
  const theId = UrlHelpers.getIdFromUlr(req.url);

  // DEBUGGING:
  // App.logger.info(theId);

  const response = await timeEntriesController.getDurationStr(theId, App.mongoDbOperations);

  // DEBUGGING:
  // App.logger.info(response);

  const stringifiedResponse = Serialization.serialize(response);

  // DEBUGGING:
  // App.logger.info(stringifiedResponse);

  res.send(stringifiedResponse);
};

const deleteByTaskId = async (req: Request, res: Response) => {
  const theId = UrlHelpers.getIdFromUlr(req.url);

  // DEBUGGING:
  // App.logger.error('theId:' + theId);

  try {
    const timeEntriesByTaskId: ITimeEntryDocument[] = await timeEntriesController.getTimeEntriesForTaskIds([theId], App.mongoDbOperations);

    // DEBUGGING:
    // App.logger.error(JSON.stringify(timeEntriesByTaskId, null, 4));

    await new Promise((resolve: (value: any) => void) => {
      let theIndex = 0;
      const promiseThenLoop = () => {
        // DELETE
        // App.logger.error(theIndex + '<' + timeEntriesByTaskId.length);

        if (theIndex < timeEntriesByTaskId.length) {
          const theQueryObj: FilterQuery<any> = {};
          const oneTimeEntry: ITimeEntryDocument = timeEntriesByTaskId[theIndex];
          theQueryObj[routesConfig.timeEntryIdProperty] = oneTimeEntry.timeEntryId;

          // patch each of this entries with isDeletedInClient = true
          const patchPromise = timeEntriesController.patchDeletedInClient(req, App.mongoDbOperations, theQueryObj);
          patchPromise.then(() => {
            theIndex++;
            promiseThenLoop();
          });
          patchPromise.catch(() => {
            theIndex++;
            promiseThenLoop();
          });
        } else {
          // DEBUGGING
          // App.logger.error('finished');
          resolve(true);
        }
      };
      // initial call
      promiseThenLoop();
    });
    res.json(true);
  } catch (e) {
    App.logger.error(e);
    res.json(null);
  }
};

const getRunningTimeEntryHandler = async (req: Request, res: Response) => {
  const runningTimeEntries: ITimeEntryDocument[] = await timeEntriesController.getRunning(App.mongoDbOperations);
  if (runningTimeEntries.length === 0) {
    res.send(Serialization.serialize(null));
    return;
  }
  if (runningTimeEntries.length > 1) {
    App.logger.error('more than one running time-entry found');
  }

  const stringifiedResponse = Serialization.serialize(runningTimeEntries[0]);
  res.send(stringifiedResponse);
};

const getViaIdHandler = async (req: Request, res: Response) => {
  const timeEntriesId = UrlHelpers.getIdFromUlr(req.url);
  const filterQuery: FilterQuery<any> = {};
  filterQuery[routesConfig.timeEntryIdProperty] = timeEntriesId;
  const timeEntriesPromise = timeEntriesController.get(req, App.mongoDbOperations, filterQuery);
  const timeEntries: ITimeEntryDocument[] = await timeEntriesPromise;

  if (!timeEntries || timeEntries.length !== 1) {
    App.logger.error('no or more than one time entry found');
    res.send(null);
    return;
  }

  const stringifiedResponse = Serialization.serialize(timeEntries[0]);
  res.send(stringifiedResponse);
};

const getTimeInterval = async (req: Request, res: Response)  => {
  // DEBUGGING:
  // App.logger.info('getTimeInterval');

  const startTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.startTimeProperty);
  const endTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.endDateProperty);

  if (!startTimeUtc || !endTimeUtc) {
    App.logger.error('not utc - start- or end-time');
    res.send('');
    return;
  }
  const timeEntryDocsByInterval: ITimeEntryDocument[] = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, startTimeUtc, endTimeUtc);
  if (!timeEntryDocsByInterval || !timeEntryDocsByInterval.length) {
    App.logger.error('no time entries found');
    res.send([]);
    return;
  }
  const contextLines: IContextLine[] = await taskController.generateContextLinesFrom(timeEntryDocsByInterval, App.mongoDbOperations);

  const serialized = Serialization.serialize(contextLines);
  res.send(serialized);
};

const getStatisticsHandler = async (req: Request, res: Response) => {
  const isRawBookingBased = UrlHelpers.getProperty(req.url, routesConfig.isBookingBasedPropertyName);
  const isBookingBased = JSON.parse(isRawBookingBased as string);
  const isTakenCareIsDisabledRaw = UrlHelpers.getProperty(req.url, routesConfig.isTakenCareIsDisabledPropertyName);
  const isTakenCareIsDisabled = JSON.parse(isTakenCareIsDisabledRaw as string);
  // DEBUGGING:
  // App.logger.info(isBookingBased);

  let groupCategory = UrlHelpers.getProperty(req.url, routesConfig.groupCategoryPropertyName);
  if (groupCategory === 'null') {
    groupCategory = null;
  }
  // DEBUGGING:
  // App.logger.info(groupCategory);

  const startTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.startTimeProperty);
  const endTimeUtc = UrlHelpers.getDateObjFromUrl(req.url, routesConfig.endDateProperty);
  if (!startTimeUtc || !endTimeUtc) {
    App.logger.error('no time stamps found in url');
    res.send('no time stamps in ulr');
    return;
  }

  // //  DEBUGGING
  // App.logger.info(groupCategory);
  // App.logger.info(startTimeUtc.toUTCString());
  // App.logger.info(endTimeUtc.toUTCString());
  try {
    let oneSummary: ITimeSummary;
    if (!isTakenCareIsDisabled) {
      oneSummary = await CalculateDurationsByInterval.calculate(startTimeUtc, endTimeUtc, isBookingBased, groupCategory);
    } else {
      if (isBookingBased) {
        oneSummary = await CalculateDurationsByInterval.calculate(startTimeUtc, endTimeUtc, isBookingBased, groupCategory, routesConfig.isDeletedInClientProperty, false);
      } else {
        oneSummary = await CalculateDurationsByInterval.calculate(startTimeUtc, endTimeUtc, isBookingBased, groupCategory, routesConfig.isDisabledInCommit, false);
      }
    }
    if (!oneSummary) {
      // DEBUGGING:
      // App.logger.error('no summaries');
      res.send('');
      return;
    }

    if (groupCategory !== null) {
      if (!oneSummary) {
        App.logger.error('there is no summary for:' + groupCategory);
        res.send('');
        return;
      }
      const summaryValues = Object.values(oneSummary);
      const summaryByTaskCategories: ISummarizedTasks[] = await CalculateDurationsByInterval.convertTimeSummaryToSummarizedTasks(summaryValues, App.mongoDbOperations);

      const serialized = Serialization.serialize(summaryByTaskCategories);
      res.send(serialized);
    } else {
      // DEBUGGING
      // App.logger.info('groupCategory from url is null');
      if (isBookingBased) {
        // const summaryByTasksIndependentOfCategory: ISummarizedTasks[] = await CalculateDurationsByInterval.aggregateSummarizedTasks(summaries, App.mongoDbOperations);
        // const serialized = Serialization.serialize(summaryByTasksIndependentOfCategory);
        const serialized = Serialization.serialize(oneSummary);
        res.send(serialized);
        return;
      } else {
        App.logger.error('category is null but isBookingBased:' + isBookingBased);
        App.logger.error('returning');
        res.send('');
        return;
      }
    }
  } catch (e) {
    App.logger.error('timeEntries.getStatisticsHandler error:');
    App.logger.error(JSON.stringify(e, null, 4));
    res.send(JSON.stringify(e, null, 4));
  }
};

const postCsvWrite = async (req: Request, res: Response) => {
  const body = Serialization.deSerialize<any>(req.body);
  const bodyData: any = body[routesConfig.isCsvWrittenTriggerPropertyName];
  const isCsvWritten: boolean = bodyData[routesConfig.isCsvFileWrittenProperty];
  if (!isCsvWritten) {
    return;
  }
  const utcStartTime = bodyData[routesConfig.startTimeProperty];
  const utcEndTime = bodyData[routesConfig.endDateProperty];
  // TODO: this data must be cached and re-used instead of re-fetched!!!
  const timeEntries = await timeEntriesController.getDurationsByInterval(App.mongoDbOperations, utcStartTime, utcEndTime);

  const response = await timeEntriesController.postCsvWrite(timeEntries);
  const stringifiedResponse = Serialization.serialize(response);
  res.send(stringifiedResponse);
};

const rootRoute = router.route('/');
rootRoute.get(getTimeEntries);
rootRoute.post(postTimeEntries);

const csvWriteRoute = router.route(routesConfig.postCsvFileTriggerSuffix);
csvWriteRoute.post(postCsvWrite);

const stopRoute = router.route(routesConfig.timeEntriesStopPathSuffix);
stopRoute.patch(patchTimeEntriesStop);

const deleteRoute = router.route(routesConfig.timeEntriesDeletePathSuffix);
deleteRoute.patch(patchTimeEntriesDelete);

const durationRoute = router.route(routesConfig.timeEntriesDurationSuffix + '/*');
durationRoute.get(getDurationStr);

const getInterval = router.route(routesConfig.timeEntriesIntervalSuffix + '*');
getInterval.get(getTimeInterval);

const deleteByTaskIdRoute = router.route(routesConfig.deleteTimeEntryByTaskIdSuffix + '/*');
deleteByTaskIdRoute.delete(deleteByTaskId);

const getViaTaskIdRoute = router.route(routesConfig.timeEntriesViaTaskIdSuffix + '/*');
getViaTaskIdRoute.get(getViaTaskId);

const getRunning = router.route(routesConfig.timeEntriesRunningSuffix);
getRunning.get(getRunningTimeEntryHandler);

const getStatistics = router.route(routesConfig.timeEntriesStatisticsSufffix + '/*');
getStatistics.get(getStatisticsHandler);

const getNonCommittedDays = router.route(routesConfig.nonCommittedDaysSuffix);
getNonCommittedDays.get(getNonCommittedDaysHandler);

const getViaId = router.route('/*');
getViaId.get(getViaIdHandler);

export default router;

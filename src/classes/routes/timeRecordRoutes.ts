import express, { Request, Response } from 'express';
import timeRecordController from '../controllers/timeRecordController'; // cont
import { App } from '../../app';
// @ts-ignore
import routes from '../../../../common/typescript/routes';
import { ITimeRecordsDocumentData } from '../../../../common/typescript/mongoDB/iTimeRecordsDocument';
import { Serialization } from '../../../../common/typescript/helpers/serialization';
import { Constants } from '../../../../common/typescript/constants';
import { Duration } from 'luxon';

// https://github.com/linnovate/mean/blob/master/server/routes/user.route.js

const router = express.Router();

const postTimeRecord = async (req: Request, res: Response) => {
  const body = Serialization.deSerialize<any>(req.body);

  const line: ITimeRecordsDocumentData = body[routes.timeRecordBodyProperty];
  const collectionName: string = body[routes.collectionNamePropertyName];

  const calculatedMilliseconds = Math.floor(line.durationInHours * Constants.MILLISECONDS_IN_HOUR);
  let calculatedDuration = Duration.fromMillis(calculatedMilliseconds);
  calculatedDuration = calculatedDuration.shiftTo(...Constants.shiftToParameter);
  line.durationInMilliseconds = calculatedDuration.toObject();

  // DEBUGGING:
  // App.logger.info(JSON.stringify(line.durationInHours, null, 4));
  // App.logger.info(JSON.stringify(calculatedMilliseconds, null, 4));
  // App.logger.info(JSON.stringify(line.durationInMilliseconds, null, 4));

  // a) write into db
  await timeRecordController.post(collectionName, line, App.mongoDbOperations);

  // b) mark timeEntries as isDeletedInClient
  let markAsDeletedResult = null;
  if (collectionName === routes.timeRecordsCollectionName) {
    markAsDeletedResult = await timeRecordController.markTimeEntriesAsDeleted(routes.isDeletedInClientProperty, line._timeEntryIds, App.mongoDbOperations);
  } else if (collectionName === routes.commitTimeRecordsCollectionName) {
    markAsDeletedResult = await timeRecordController.markTimeEntriesAsDeleted(routes.isDisabledInCommit, line._timeEntryIds, App.mongoDbOperations);
  } else {
    App.logger.error(collectionName);
  }

  res.json(markAsDeletedResult);
};

router.route('/').post(postTimeRecord);

export default router;

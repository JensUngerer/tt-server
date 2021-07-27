import { FilterQuery } from 'mongodb';
import { MonogDbOperations } from '../helpers/mongoDbOperations';
import { ISessionTimeEntryDocument } from './../../../../common/typescript/mongoDB/iSessionTimeEntryDocument';

// @ts-ignore
import routesConfig from './..&../../../../../../common/typescript/routes.js';
import { DateTime, Duration, DurationObject } from 'luxon';
import { Logger } from '../../logger';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';

export default {
  getDurationFromRunningSessionTimeEntry(sessionTimeEntry: ISessionTimeEntryDocument) {
    const endTime = new Date();
    const startTime = sessionTimeEntry.startTime;
    const timeSpanInMilliseconds = endTime.getTime() - startTime.getTime();
    const duration = Duration.fromMillis(timeSpanInMilliseconds);
    return duration;
  },
  getDurationStr(timeEntryId: string, mongoDbOperations: MonogDbOperations) {
    const queryObj: FilterQuery<any> = {};
    queryObj[routesConfig.timeEntryIdProperty] = timeEntryId;
    const timeEntriesPromise = mongoDbOperations.getFiltered(routesConfig.sessionTimEntriesCollectionName, queryObj);

    return new Promise<string>((resolve: (value: string) => void) => {
      timeEntriesPromise.then((sessionTimeEntryDocs: ISessionTimeEntryDocument[]) => {
        if (!sessionTimeEntryDocs ||
          !sessionTimeEntryDocs.length) {
          Logger.instance.error('sessionTimeEntryDocs.length:' + sessionTimeEntryDocs.length);
          resolve('');
          return;
        }
        if (sessionTimeEntryDocs.length > 1) {
          Logger.instance.error('more than one document found for sessionTimeEntry');
          resolve('');
          return;
        }
        try {
          const firstAndSingleDocument = sessionTimeEntryDocs[0];

          const storedDuration = firstAndSingleDocument.durationInMilliseconds as DurationObject;
          if (storedDuration) {
            const duration = Duration.fromObject(storedDuration);
            const durationStr = duration.toFormat('hh:mm:ss');
            resolve(durationStr);
          } else {
            const duration = this.getDurationFromRunningSessionTimeEntry(firstAndSingleDocument);
            const durationStr = duration.toFormat('hh:mm:ss');
            resolve(durationStr);
          }
        } catch (exception) {
          Logger.instance.error(exception);
          resolve('');
        }
      });
      timeEntriesPromise.catch((err: any) => {
        Logger.instance.error(err);
        resolve('');
      });
    });
  },
  getWorkingTimeDurationStr(mongoDbOperations: MonogDbOperations) {
    const queryObj: FilterQuery<any> = {};
    const now = new Date();
    queryObj.day = DurationCalculator.getDayFrom(now).toISOString();

    return new Promise((resolve: (value?: any) => void) => {
      const allSessionTimeEntriesFromTodayPromise = mongoDbOperations.getFiltered(routesConfig.sessionTimEntriesCollectionName, queryObj);
      allSessionTimeEntriesFromTodayPromise.then((docsFromToDay: ISessionTimeEntryDocument[]) => {
        try {
          if (!docsFromToDay ||
            !docsFromToDay.length) {
            Logger.instance.error('no docs from today');
            resolve('');
            return;
          }
          const durationSum = new DateTime();
          for (const oneDocFromToday of docsFromToDay) {
            const oneDurationInMilliseconds = oneDocFromToday.durationInMilliseconds as DurationObject;
            let oneDuration;
            if (!oneDurationInMilliseconds) {
              oneDuration = this.getDurationFromRunningSessionTimeEntry(oneDocFromToday);
            } else {
              oneDuration = Duration.fromObject(oneDurationInMilliseconds);
            }
            durationSum.plus(oneDuration);
          }
          const calculatedMilliseconds = durationSum.toMillis();

          // DEBUGGING:
          Logger.instance.info('caluclated working time millis:' + calculatedMilliseconds);

          const resultDuration = Duration.fromMillis(calculatedMilliseconds);
          const resultStr = resultDuration.toFormat('hh:mm:ss');

          // DEBUGGING:
          Logger.instance.info('calculated working time duration:' + resultStr);

          resolve(resultStr);
        } catch (exception) {
          Logger.instance.error(exception);
          resolve('');
        }
      });
      allSessionTimeEntriesFromTodayPromise.catch((err) => {
        Logger.instance.error(err);
        resolve('');
      });
    });
  },
};

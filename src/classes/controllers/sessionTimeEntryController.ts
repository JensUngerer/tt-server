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

          const workingTimeDurationStrPromise = this.getWorkingTimeDurationStr(mongoDbOperations);
          workingTimeDurationStrPromise.then((workingTime: string) => {
            Logger.instance.info('working time:' + workingTime);
          });
          workingTimeDurationStrPromise.catch((error) => {
            Logger.instance.error(error);
          });
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
    const now = new Date();
    // https://stackoverflow.com/questions/30872891/convert-string-to-isodate-in-mongodb/30878727
    const dayStr = DurationCalculator.getDayFrom(now).toISOString();
    // https://stackoverflow.com/questions/952924/javascript-chop-slice-trim-off-last-character-in-string
    // dayStr = dayStr.substring(0, dayStr.length-1);
    // const nextDayStr = DurationCalculator.getNextDayFrom(now);//.toISOString();
    // nextDayStr = nextDayStr.substring(0, nextDayStr.length-1);
    // const format = '%Y-%m-%dT%H:%M:%S.%L';
    // const timezone = 'UTC';
    // const gteStartTime =
    // {
    //   $dateFromString: {
    //     dateString: dayStr,
    //     format,
    //     timezone,
    //   },
    // };
    // const ltStartTime =
    // {
    //   $dateFromString: {
    //     dateString: nextDayStr,
    //     format,
    //     timezone,
    //   },
    // };
    // const queryObj: FilterQuery<any> = {
    //   startTime: {
    //     $gte: gteStartTime,
    //     $lt: ltStartTime,
    //   },
    // };
    const queryObj: FilterQuery<any> = {
      day: {
        $eq: dayStr,
      },
    };

    Logger.instance.info(JSON.stringify(queryObj, null, 4));

    return new Promise((resolve: (value?: any) => void) => {
      try {
        const allSessionTimeEntriesFromTodayPromise = mongoDbOperations.getFiltered(routesConfig.sessionTimEntriesCollectionName, queryObj);
        allSessionTimeEntriesFromTodayPromise.then((docsFromToDay: ISessionTimeEntryDocument[]) => {
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
        });
        allSessionTimeEntriesFromTodayPromise.catch((err) => {
          Logger.instance.error(err);
          resolve('');
        });
      } catch (exception) {
        Logger.instance.error(exception);
        resolve('');
      }
    });
  },
};

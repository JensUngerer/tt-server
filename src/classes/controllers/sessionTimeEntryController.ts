import { FilterQuery } from 'mongodb';
import { MonogDbOperations } from '../helpers/mongoDbOperations';
import { ISessionTimeEntryDocument } from './../../../../common/typescript/mongoDB/iSessionTimeEntryDocument';

// @ts-ignore
import routesConfig from './..&../../../../../../common/typescript/routes.js';
import { Duration, DurationObject } from 'luxon';
import { Logger } from '../../logger';
import { Constants } from '../../../../common/typescript/constants';
// import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';

export default {
  getDurationFromRunningSessionTimeEntry(sessionTimeEntry: ISessionTimeEntryDocument) {
    try {
      const endTime = new Date();
      const startTime = sessionTimeEntry.startTime;
      const timeSpanInMilliseconds = endTime.getTime() - startTime.getTime();
      const duration = Duration.fromMillis(timeSpanInMilliseconds);
      return duration;
    } catch (exception) {
      Logger.instance.error(exception);
      return new Duration();
    }
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

          // const workingTimeDurationStrPromise = this.getWorkingTimeDurationStr(mongoDbOperations);
          // workingTimeDurationStrPromise.then((workingTime: string) => {
          //   Logger.instance.info('working time:' + workingTime);
          // });
          // workingTimeDurationStrPromise.catch((error) => {
          //   Logger.instance.error(error);
          // });
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
  getTimeStrFromSessionTimeEntry(docs: ISessionTimeEntryDocument[]) {
    try {
      Logger.instance.info(JSON.stringify(docs, null, 4));

      let durationSum = Duration.fromObject({years: 0, months: 0, days: 0, hour: 0, minutes: 0, milliseconds: 0});
      durationSum = durationSum.shiftTo(...Constants.shiftToParameter);
      // DateTime.fromObject({years: 0, months: 0, days: 0, hour: 0, minutes: 0, milliseconds: 0});

      Logger.instance.info('dateTime crated');

      for (let index = 0; index < docs.length; index++) {
        const oneDocFromToday = docs[index];
        Logger.instance.info(JSON.stringify(oneDocFromToday, null, 4));

        const oneDurationInMilliseconds = oneDocFromToday.durationInMilliseconds as DurationObject;
        let oneDuration;
        if (!oneDurationInMilliseconds) {
          oneDuration = this.getDurationFromRunningSessionTimeEntry(oneDocFromToday);
        } else {
          Logger.instance.info('stored duration in milliseconds:');
          Logger.instance.info(JSON.stringify(oneDurationInMilliseconds, null, 4));

          oneDuration = Duration.fromObject(oneDurationInMilliseconds);
          oneDuration = oneDuration.shiftTo(...Constants.shiftToParameter);

          Logger.instance.info(JSON.stringify(oneDuration.toObject(), null, 4));
          // Logger.instance.info(JSON.stringify(oneDuration));
          // Logger.instance.info(oneDuration.toString());
        }
        durationSum = durationSum.plus(oneDuration);
        durationSum = durationSum.shiftTo(...Constants.shiftToParameter);
        Logger.instance.info(durationSum.toString());
      }

      // for (const oneDocFromToday of docs) {
      //   // DEBUGGING:

      // }
      const calculatedMilliseconds = durationSum.toMillis();

      // DEBUGGING:
      Logger.instance.info('caluclated working time millis:' + calculatedMilliseconds);

      const resultDuration = Duration.fromMillis(calculatedMilliseconds);
      const resultStr = resultDuration.toFormat('hh:mm:ss');

      // DEBUGGING:
      Logger.instance.info('calculated working time duration:' + resultStr);

      return resultStr;
    } catch (exception: any) {
      Logger.instance.error(exception);
      return '';
    }

  },
  getWorkingTimeByDay(mongoDbOperations: MonogDbOperations, selectedDay: Date) {
    return new Promise((resolve: (value: string) => void) => {
      try {
        const docsPromise = mongoDbOperations.filterByDay(routesConfig.sessionTimEntriesCollectionName, selectedDay);
        if (!docsPromise) {
          Logger.instance.error('no docs promise');
          return;
        }
        docsPromise.then((docs: ISessionTimeEntryDocument[]) => {
          if (!docs ||
            !docs.length) {
            resolve('');
            return;
          }
          Logger.instance.info('found docs number of items:' + docs.length);
          const timeStr = this.getTimeStrFromSessionTimeEntry(docs);
          resolve(timeStr);
        });
      } catch (exception: any) {
        Logger.instance.error('getWorkingTime failed:');
        Logger.instance.error(exception);
        resolve('');
      }
    });
  },
  // getWorkingTimeDurationStr(mongoDbOperations: MonogDbOperations) {
  //   const now = new Date();
  //   // https://stackoverflow.com/questions/30872891/convert-string-to-isodate-in-mongodb/30878727
  //   const dayStr = DurationCalculator.getDayFrom(now).toISOString();
  //   // https://stackoverflow.com/questions/952924/javascript-chop-slice-trim-off-last-character-in-string
  //   // dayStr = dayStr.substring(0, 10);
  //   // const nextDayStr = DurationCalculator.getNextDayFrom(now);//.toISOString();
  //   // nextDayStr = nextDayStr.substring(0, nextDayStr.length-1);
  //   // const format = '%Y-%m-%dT%H:%M:%S.%L';
  //   // const timezone = 'UTC';
  //   // const gteStartTime =
  //   // {
  //   //   $dateFromString: {
  //   //     dateString: dayStr,
  //   //     format,
  //   //     timezone,
  //   //   },
  //   // };
  //   // const ltStartTime =
  //   // {
  //   //   $dateFromString: {
  //   //     dateString: nextDayStr,
  //   //     format,
  //   //     timezone,
  //   //   },
  //   // };
  //   // const queryObj: FilterQuery<any> = {
  //   //   startTime: {
  //   //     $gte: gteStartTime,
  //   //     $lt: ltStartTime,
  //   //   },
  //   // };
  //   // const queryObj: FilterQuery<any> = {
  //   //   day: {
  //   //     $eq: {
  //   //       $toDate: dayStr,
  //   //     },
  //   //   },
  //   // };
  //   const queryObj: FilterQuery<any> = {};
  //   Logger.instance.info(JSON.stringify(queryObj, null, 4));

  //   return new Promise((resolve: (value?: any) => void) => {
  //     try {
  //       const allSessionTimeEntriesFromTodayPromise = mongoDbOperations.getFiltered(routesConfig.sessionTimEntriesCollectionName, queryObj);
  //       allSessionTimeEntriesFromTodayPromise.then((docsFromToDay: ISessionTimeEntryDocument[]) => {
  //         if (!docsFromToDay ||
  //           !docsFromToDay.length) {
  //           Logger.instance.error('no docs from today');
  //           resolve('');
  //           return;
  //         }

  //         const filteredDocs = docsFromToDay.filter((oneDoc: ISessionTimeEntryDocument) => {
  //           return oneDoc.day?.toISOString() === dayStr;
  //         });
  //         if (!filteredDocs ||
  //           !filteredDocs.length) {
  //           Logger.instance.error('no docs for:' + dayStr);
  //           resolve('');
  //           return;
  //         }

  //         const durationSum = new DateTime();
  //         for (const oneDocFromToday of filteredDocs) {
  //           const oneDurationInMilliseconds = oneDocFromToday.durationInMilliseconds as DurationObject;
  //           let oneDuration;
  //           if (!oneDurationInMilliseconds) {
  //             oneDuration = this.getDurationFromRunningSessionTimeEntry(oneDocFromToday);
  //           } else {
  //             oneDuration = Duration.fromObject(oneDurationInMilliseconds);
  //           }
  //           durationSum.plus(oneDuration);
  //         }
  //         const calculatedMilliseconds = durationSum.toMillis();

  //         // DEBUGGING:
  //         Logger.instance.info('caluclated working time millis:' + calculatedMilliseconds);

  //         const resultDuration = Duration.fromMillis(calculatedMilliseconds);
  //         const resultStr = resultDuration.toFormat('hh:mm:ss');

  //         // DEBUGGING:
  //         Logger.instance.info('calculated working time duration:' + resultStr);

  //         resolve(resultStr);
  //       });
  //       allSessionTimeEntriesFromTodayPromise.catch((err) => {
  //         Logger.instance.error(err);
  //         resolve('');
  //       });
  //     } catch (exception) {
  //       Logger.instance.error(exception);
  //       resolve('');
  //     }
  //   });
  // },
};

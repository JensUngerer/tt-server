import { FilterQuery } from 'mongodb';
import { MonogDbOperations } from '../helpers/mongoDbOperations';
import { ISessionTimeEntryDocument } from './../../../../common/typescript/mongoDB/iSessionTimeEntryDocument';

// @ts-ignore
import routesConfig from './..&../../../../../../common/typescript/routes.js';
import { DateTime, Duration, DurationObject } from 'luxon';
import { Logger } from '../../logger';
import { Constants } from '../../../../common/typescript/constants';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';

export default {
  getWorkingTimeEntriesByDay(mongoDbOperations: MonogDbOperations, selectedDay: Date,  additionalCriteria?: {[key: string]: any}) {
    return new Promise((resolve: (value: ISessionTimeEntryDocument[]) => void) => {
      try {
        const docsPromise = mongoDbOperations.filterByDay(routesConfig.sessionTimEntriesCollectionName, selectedDay, additionalCriteria);
        if (!docsPromise) {
          Logger.instance.error('no docs promise');
          resolve([]);
          return;
        }
        docsPromise.then((docs: ISessionTimeEntryDocument[]) => {
          if (!docs ||
            !docs.length) {
            resolve([]);
            return;
          }
          resolve(docs);
        });
      } catch (exception: any) {
        Logger.instance.error('getWorkingTime failed:');
        Logger.instance.error(exception);
        resolve([]);
      }
    });
  },
  getWorkingDaysOfCurrentWeek() {
    // cf.: https://stackoverflow.com/questions/50350110/how-to-create-momentlocaledata-firstdayofweek-in-luxon
    const today = new Date();
    const todayInUtc = DurationCalculator.getDayFrom(today);

    const lastMonday = DateTime.local().startOf('week');
    const lastMondayJSDate = lastMonday.toJSDate();
    const lastMondayInUtc = DurationCalculator.getDayFrom(lastMondayJSDate);

    const currentWorkingWeek = [lastMondayInUtc];
    let currentDay = lastMondayInUtc;
    const NUMBER_OF_DAYS_IN_WEEK_MINUS_FIRST_ONE = 6;
    for (let index = 0; index < NUMBER_OF_DAYS_IN_WEEK_MINUS_FIRST_ONE; index++) {
      // https://stackoverflow.com/questions/492994/compare-two-dates-with-javascript
      if (currentDay.getTime() === todayInUtc.getTime()) {
        break;
      }
      currentDay = DurationCalculator.getNextDayFrom(currentDay);
      currentWorkingWeek.push(currentDay);
    }
    return currentWorkingWeek;
  },
  getWorkingTimeByWeek(mongoDbOperations: MonogDbOperations) {
    let durationSum = Duration.fromObject(Constants.durationInitializationZero);
    durationSum = durationSum.shiftTo(...Constants.shiftToParameter);

    return new Promise((resolve: (value?: Duration) => void) => {
      const currentWorkingWeek = this.getWorkingDaysOfCurrentWeek();
      if (!currentWorkingWeek ||
        !currentWorkingWeek.length) {
        resolve(durationSum);
        return;
      }

      let loopIndex = 0;
      const loop = () => {
        if (loopIndex >= currentWorkingWeek.length) {
          resolve(durationSum);
          return;
        }
        const oneDay = currentWorkingWeek[loopIndex];
        const oneDayDurationPromise = this.getWorkingTimeByDay(mongoDbOperations, oneDay);
        oneDayDurationPromise.then((oneDayDuration) => {
          durationSum = durationSum.plus(oneDayDuration);

          loopIndex++;
          loop();
        });
        oneDayDurationPromise.catch((err) => {
          Logger.instance.error(err);

          loopIndex++;
          loop();
        });
      };
      //initial call
      loop();
    });
  },
  getDurationFromRunningSessionTimeEntry(sessionTimeEntry: ISessionTimeEntryDocument) {
    try {
      const endTime = new Date();
      const startTime = sessionTimeEntry.startTime;
      const timeSpanInMilliseconds = endTime.getTime() - startTime.getTime();
      const duration = Duration.fromMillis(timeSpanInMilliseconds);
      return duration;
    } catch (exception) {
      Logger.instance.error(exception);
      let zeroDuration = Duration.fromObject(Constants.durationInitializationZero);
      zeroDuration = zeroDuration.shiftTo(...Constants.shiftToParameter);
      return zeroDuration;
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
      // Logger.instance.info(JSON.stringify(docs, null, 4));

      let durationSum = Duration.fromObject(Constants.durationInitializationZero);
      durationSum = durationSum.shiftTo(...Constants.shiftToParameter);

      for (let index = 0; index < docs.length; index++) {
        const oneDocFromToday = docs[index];
        // Logger.instance.info(JSON.stringify(oneDocFromToday, null, 4));

        const oneDurationInMilliseconds = oneDocFromToday.durationInMilliseconds as DurationObject;
        let oneDuration;
        if (!oneDurationInMilliseconds) {
          oneDuration = this.getDurationFromRunningSessionTimeEntry(oneDocFromToday);
        } else {
          // Logger.instance.info('stored duration in milliseconds:');
          // Logger.instance.info(JSON.stringify(oneDurationInMilliseconds, null, 4));

          oneDuration = Duration.fromObject(oneDurationInMilliseconds);
          oneDuration = oneDuration.shiftTo(...Constants.shiftToParameter);

          // Logger.instance.info(JSON.stringify(oneDuration.toObject(), null, 4));
        }
        durationSum = durationSum.plus(oneDuration);
        durationSum = durationSum.shiftTo(...Constants.shiftToParameter);
        // Logger.instance.info(durationSum.toString());
      }

      // const calculatedMilliseconds = durationSum.toMillis();

      // DEBUGGING:
      // Logger.instance.info('caluclated working time millis:' + calculatedMilliseconds);

      // const resultDuration = Duration.fromMillis(calculatedMilliseconds);
      // const resultStr = durationSum.toFormat('hh:mm:ss');

      // DEBUGGING:
      // Logger.instance.info('calculated working time duration:' + resultStr);

      // return resultStr;
      return durationSum;
    } catch (exception: any) {
      Logger.instance.error(exception);
      let zeroDuration = Duration.fromObject(Constants.durationInitializationZero);
      zeroDuration = zeroDuration.shiftTo(...Constants.shiftToParameter);
      return zeroDuration;
    }

  },
  getWorkingTimeByDay(mongoDbOperations: MonogDbOperations, selectedDay: Date) {
    let zeroDuration = Duration.fromObject(Constants.durationInitializationZero);
    zeroDuration = zeroDuration.shiftTo(...Constants.shiftToParameter);

    // undefined -> no additional criteria -> so "get everything", also non completed time entries
    const workingTimeEntriesPromise = this.getWorkingTimeEntriesByDay(mongoDbOperations, selectedDay, undefined);
    return new Promise((resolve: (value: Duration) => void) => {
      try {
        workingTimeEntriesPromise.then((docs: ISessionTimeEntryDocument[]) => {
          // Logger.instance.info('found docs number of items:' + docs.length);
          const duration = this.getTimeStrFromSessionTimeEntry(docs);
          resolve(duration);
        });
        workingTimeEntriesPromise.catch((err: any) => {
          Logger.instance.error(err);
          resolve(zeroDuration);
        });
      }
      catch (exception) {
        Logger.instance.error(exception);
        resolve(zeroDuration);
      }
    });
  },
};

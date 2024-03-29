import { FilterQuery } from 'mongodb';
import { MonogDbOperations } from '../helpers/mongoDbOperations';
// @ts-ignore
import routes from '../../../../common/typescript/routes.js';
import { Constants } from '../../../../common/typescript/constants';
import { Duration } from 'luxon';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';
import { Logger } from '../../logger';
import { ITimeEntryBase } from '../../../../common/typescript/iTimeEntry';

export default {
  createSessionTimeEntryAtStart(mongoDbOperations: MonogDbOperations, sessionIdAsTimeEntryId: string) {
    const startTime = new Date();
    const sessionTimeEntry: ITimeEntryBase = {
      startTime,
      timeEntryId: sessionIdAsTimeEntryId,
      day: DurationCalculator.getDayFrom(startTime),
    };
    return mongoDbOperations.insertOne(sessionTimeEntry, routes.sessionTimEntriesCollectionName);
  },
  updateSessionTimeEntryAtStop(mongoDbOperations: MonogDbOperations, sessionIdAsTimeEntryId: string) {
    return new Promise((resolve: (value?: any) => void) => {

      const filterQuery: FilterQuery<any> = {
        timeEntryId: sessionIdAsTimeEntryId,
      };
      const sessionTimeEntryPromise = mongoDbOperations.getFiltered(routes.sessionTimEntriesCollectionName, filterQuery);
      sessionTimeEntryPromise.then((docs: ITimeEntryBase[]) => {
        if (!docs || !docs.length) {
          resolve(false);
          return;
        }
        const endTime = new Date();
        const storedSessionTimeEntry = docs[0];
        const startTime = storedSessionTimeEntry.startTime;
        const calculatedMilliseconds = endTime.getTime() - startTime.getTime();
        let calculatedDuration = Duration.fromMillis(calculatedMilliseconds);
        calculatedDuration = calculatedDuration.shiftTo(...Constants.shiftToParameter);
        storedSessionTimeEntry.endTime = endTime;
        storedSessionTimeEntry.durationInMilliseconds = calculatedDuration.toObject();

        var innerPromise = mongoDbOperations.updateOne('timeEntryId', sessionIdAsTimeEntryId, storedSessionTimeEntry, routes.sessionTimEntriesCollectionName);
        innerPromise.then(() => {
          resolve(true);
        });
      });
      sessionTimeEntryPromise.catch((err) => {
        Logger.instance.error(err);
        resolve(false);
      });
    });
  },
};

import { FilterQuery } from 'mongodb';
import { MonogDbOperations } from '../helpers/mongoDbOperations';
// @ts-ignore
import routes from '../../../../common/typescript/routes.js';
import { ISessionTimeEntry } from '../../../../common/typescript/iSessionTimeEntry';
import { Constants } from '../../../../common/typescript/constants';
import { Duration } from 'luxon';
import { DurationCalculator } from '../../../../common/typescript/helpers/durationCalculator';

export default {
  createSessionTimeEntryAtStart(mongoDbOperations: MonogDbOperations, sessionIdAsTimeEntryId: string) {
    const startTime = new Date();
    const sessionTimeEntry: ISessionTimeEntry = {
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
      sessionTimeEntryPromise.then((docs: ISessionTimeEntry[]) => {
        if (!docs || !docs.length) {
          return;
        }
        const endTime = new Date();
        const storedSessionTimeEntry = docs[0];
        const startTime = storedSessionTimeEntry.startTime;
        const calculatedMilliseconds = endTime.getTime() - startTime.getTime();
        const calculatedDuration = Duration.fromMillis(calculatedMilliseconds);
        calculatedDuration.shiftTo(...Constants.shiftToParameter);
        storedSessionTimeEntry.endTime = endTime;
        storedSessionTimeEntry.durationInMilliseconds = calculatedDuration.toObject();

        var innerPromise = mongoDbOperations.updateOne('timeEntryId', sessionIdAsTimeEntryId, storedSessionTimeEntry, routes.sessionTimEntriesCollectionName);
        innerPromise.then(() => {
        });
      });
    });
  },
};

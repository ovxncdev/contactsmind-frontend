import { PropertyFilters } from '../posthog-surveys-types';
import type { Properties, PropertyMatchType } from '../types';
export declare function getPersonPropertiesHash(distinct_id: string, userPropertiesToSet?: Properties, userPropertiesToSetOnce?: Properties): string;
export declare const propertyComparisons: Record<PropertyMatchType, (targets: string[], values: string[]) => boolean>;
export declare function matchPropertyFilters(propertyFilters: PropertyFilters | undefined, eventProperties: Properties | undefined): boolean;

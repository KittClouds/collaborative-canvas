/**
 * Networks Feature Module
 * 
 * UI components and features for network management.
 */

// Components
export * from './components';

// Re-export core functionality from lib
export {
    networkAutoMembership,
    findMatchingSchemas,
    checkAndAutoEnroll,
    getRelationshipNetworkMemberships,
    getAvailableNetworksForRelationship,
    addRelationshipToNetwork,
    removeRelationshipFromNetwork,
} from '@/lib/networks/autoMembership';

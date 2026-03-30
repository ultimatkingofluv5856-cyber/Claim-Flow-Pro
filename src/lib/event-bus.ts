/**
 * Event-Driven Architecture
 * Adds event publishing/subscribing WITHOUT changing existing approval workflow
 * 
 * How it works (non-breaking):
 * 1. Existing approval flow continues as-is (manager → admin → settlement)
 * 2. When approvals happen, events are emitted
 * 3. Other services subscribe and react (email, audit, analytics)
 * 4. Can be added gradually without refactoring core code
 */

export interface DomainEvent {
  /** Aggregate root ID (claim ID) */
  aggregateId: string;
  /** Type of event (ClaimSubmitted, ClaimApproved, etc.) */
  eventType: string;
  /** When it happened */
  timestamp: Date;
  /** Event version for compatibility */
  version: number;
  /** Event payload */
  data: Record<string, any>;
  /** Who triggered it */
  userId?: string;
}

type EventPayload = Record<string, any>;
type EventHandler = (event: DomainEvent) => Promise<void>;

export interface EventSubscriber {
  eventType: string;
  handler: EventHandler;
}

/**
 * Central event bus for domain events
 * Single instance shared across app
 */
class EventBus {
  private subscribers: Map<string, EventHandler[]> = new Map();
  private eventHistory: DomainEvent[] = [];

  /**
   * Subscribe to an event type
   */
  subscribe(eventType: string, handler: EventHandler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)?.push(handler);
    console.log(`📡 Subscribed to event: ${eventType}`);
  }

  /**
   * Publish an event (call this after approval logic succeeds)
   */
  async publish(event: DomainEvent): Promise<void> {
    console.log(`📨 Publishing event: ${event.eventType} for claim ${event.aggregateId}`);
    
    // Store in history
    this.eventHistory.push(event);

    // Find all handlers for this event type
    const handlers = this.subscribers.get(event.eventType) || [];

    // Execute all handlers in parallel
    const results = await Promise.allSettled(
      handlers.map(handler => handler(event))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `❌ Event handler ${index} failed for ${event.eventType}:`,
          result.reason
        );
      }
    });
  }

  /**
   * Get all events for an aggregate (claim)
   */
  getEventHistory(aggregateId: string): DomainEvent[] {
    return this.eventHistory.filter(e => e.aggregateId === aggregateId);
  }

  /**
   * Clear history (for testing)
   */
  clear(): void {
    this.subscribers.clear();
    this.eventHistory = [];
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * Predefined domain events (extend as needed)
 */
export enum DomainEventType {
  ClaimSubmitted = 'ClaimSubmitted',
  ManagerApproved = 'ManagerApproved',
  ManagerRejected = 'ManagerRejected',
  AdminApproved = 'AdminApproved',
  AdminRejected = 'AdminRejected',
  ClaimSettled = 'ClaimSettled',
  ClaimExpensesReviewed = 'ClaimExpensesReviewed'
}

/**
 * Create a domain event
 */
export function createDomainEvent(
  aggregateId: string,
  eventType: DomainEventType | string,
  data: EventPayload,
  userId?: string
): DomainEvent {
  return {
    aggregateId,
    eventType,
    timestamp: new Date(),
    version: 1,
    data,
    userId
  };
}

/**
 * Integration point: Call after manager approves claim
 * Publish event WITHOUT changing existing approval code
 * 
 * Usage in approveClaimAsManager():
 * 
 * export async function approveClaimAsManager(...) {
 *   // ... existing code ...
 *   await updateClaim(claimId, { status: 'Pending Admin Approval' });
 *   
 *   // NEW: Emit event
 *   await eventBus.publish(createDomainEvent(
 *     claimId,
 *     DomainEventType.ManagerApproved,
 *     { managerEmail, claimAmount },
 *     managerEmail
 *   ));
 *   
 *   // ... rest of existing code ...
 * }
 */
export async function publishManagerApprovalEvent(
  claimId: string,
  managerEmail: string,
  claimData: {
    claimAmount: number;
    employeeEmail: string;
    expenses?: any[];
    [key: string]: any;
  }
): Promise<void> {
  await eventBus.publish(
    createDomainEvent(claimId, DomainEventType.ManagerApproved, {
      managerEmail,
      ...claimData,
      approvedAt: new Date().toISOString()
    })
  );
}

/**
 * Integration point: Call after admin approves claim
 */
export async function publishAdminApprovalEvent(
  claimId: string,
  adminEmail: string,
  claimData: {
    claimAmount: number;
    approvedAmount: number;
    deductionAmount?: number;
    [key: string]: any;
  }
): Promise<void> {
  await eventBus.publish(
    createDomainEvent(claimId, DomainEventType.AdminApproved, {
      adminEmail,
      ...claimData,
      approvedAt: new Date().toISOString()
    })
  );
}

/**
 * Integration point: Call after claim is rejected
 */
export async function publishRejectionEvent(
  claimId: string,
  rejectorEmail: string,
  rejectorRole: string,
  reason: string,
  claimData: EventPayload = {}
): Promise<void> {
  await eventBus.publish(
    createDomainEvent(claimId, DomainEventType.ManagerRejected, {
      rejectorEmail,
      rejectorRole,
      reason,
      rejectedAt: new Date().toISOString(),
      ...claimData,
    })
  );
}

/**
 * Example event subscriber: Send email on approval
 * Register this when app starts
 */
export function subscribeToApprovalEmails(): void {
  eventBus.subscribe(
    DomainEventType.ManagerApproved,
    async (event: DomainEvent) => {
      console.log('📧 Manager Approval Event: Sending email to admin...');
      const { sendClaimApprovedEmail } = require('./send-email');
      await sendClaimApprovedEmail(event.data.employeeEmail, event.data);
    }
  );

  eventBus.subscribe(
    DomainEventType.AdminApproved,
    async (event: DomainEvent) => {
      console.log('💰 Admin Approval Event: Recording settlement transaction...');
      // Transaction already recorded in existing code,
      // but this shows how events can trigger other actions
    }
  );
}

/**
 * Example event subscriber: Log all events to audit trail
 * Register this when app starts
 */
export function subscribeToAuditLogging(): void {
  const auditEvents = [
    DomainEventType.ClaimSubmitted,
    DomainEventType.ManagerApproved,
    DomainEventType.ManagerRejected,
    DomainEventType.AdminApproved,
    DomainEventType.AdminRejected
  ];

  auditEvents.forEach(eventType => {
    eventBus.subscribe(eventType, async (event: DomainEvent) => {
      console.log(`📋 Audit Log: ${eventType} - Claim ${event.aggregateId}`);
      const { logAudit } = require('./claims-api');
      await logAudit(
        eventType,
        event.userId || 'system',
        'Claim',
        event.aggregateId,
        JSON.stringify(event.data)
      );
    });
  });
}

/**
 * Example event subscriber: Track metrics/analytics
 */
export function subscribeToAnalytics(): void {
  eventBus.subscribe(
    DomainEventType.AdminApproved,
    async (event: DomainEvent) => {
      console.log('📊 Analytics: Recording claim approval for metrics...');
      // Track approvals per manager, average time, success rate, etc.
      // Store in analytics table for dashboard
    }
  );
}

/**
 * Initialize all event subscribers
 * Call this in App.tsx useEffect on mount
 */
export function initializeEventSubscribers(): void {
  console.log('🚀 Initializing event subscribers...');
  subscribeToApprovalEmails();
  subscribeToAuditLogging();
  subscribeToAnalytics();
  console.log('✅ Event subscribers initialized');
}

/**
 * Get event metrics
 */
export function getEventMetrics(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  subscribersCount: number;
} {
  const eventsByType: Record<string, number> = {};
  eventBus['eventHistory'].forEach((event: DomainEvent) => {
    eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
  });

  return {
    totalEvents: eventBus['eventHistory'].length,
    eventsByType,
    subscribersCount: eventBus['subscribers'].size
  };
}

export default {
  eventBus,
  createDomainEvent,
  publishManagerApprovalEvent,
  publishAdminApprovalEvent,
  publishRejectionEvent,
  initializeEventSubscribers,
  DomainEventType,
  getEventMetrics
};

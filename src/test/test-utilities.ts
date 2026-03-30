/**
 * Test Utilities & Fixtures
 * Supports 90%+ test coverage target
 * Creates reusable test data and helpers
 */
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAlphanumeric(length: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length - 1)]).join('');
}

function randomWord() {
  const words = ['claim', 'travel', 'meal', 'hotel', 'project', 'expense', 'approval', 'budget'];
  return words[randomInt(0, words.length - 1)];
}

function randomSentence(wordCount = 6) {
  return `${Array.from({ length: wordCount }, () => randomWord()).join(' ')}.`;
}

const faker = {
  internet: {
    email: () => `user.${randomAlphanumeric(6).toLowerCase()}@example.com`,
  },
  person: {
    fullName: () => `Test ${randomAlphanumeric(6)}`,
  },
  helpers: {
    arrayElement: <T,>(items: T[]) => items[randomInt(0, items.length - 1)],
  },
  number: {
    int: ({ min, max }: { min: number; max: number }) => randomInt(min, max),
  },
  lorem: {
    sentence: () => randomSentence(),
  },
  string: {
    alphanumeric: (length: number) => randomAlphanumeric(length),
  },
  date: {
    recent: () => new Date(Date.now() - randomInt(0, 7) * 24 * 60 * 60 * 1000),
    past: () => new Date(Date.now() - randomInt(8, 365) * 24 * 60 * 60 * 1000),
  },
  datatype: {
    boolean: () => Math.random() >= 0.5,
  },
};

/**
 * Test user fixtures
 */
export const testUsers = {
  employee: {
    email: 'employee@example.com',
    password: 'TestPass123!',
    name: 'John Employee',
    role: 'User'
  },
  manager: {
    email: 'manager@example.com',
    password: 'TestPass123!',
    name: 'Jane Manager',
    role: 'Manager'
  },
  admin: {
    email: 'admin@example.com',
    password: 'TestPass123!',
    name: 'Admin User',
    role: 'Admin'
  }
};

/**
 * Create random user
 */
export function createRandomUser() {
  return {
    email: faker.internet.email(),
    password: 'TestPass123!',
    name: faker.person.fullName(),
    role: faker.helpers.arrayElement(['User', 'Manager', 'Admin'])
  };
}

/**
 * Test claim fixtures
 */
export const testClaims = {
  simple: {
    projectCode: 'TEST-001',
    claimDate: new Date().toISOString(),
    expenses: [
      {
        category: 'Travel',
        amount: 1000,
        description: 'Bus fare'
      }
    ],
    billRequired: true
  },
  complex: {
    projectCode: 'TEST-002',
    claimDate: new Date().toISOString(),
    expenses: [
      {
        category: 'Travel',
        amount: 2000,
        description: 'Flight ticket'
      },
      {
        category: 'Food',
        amount: 500,
        description: 'Meals'
      },
      {
        category: 'Accommodation',
        amount: 3000,
        description: 'Hotel stay'
      }
    ],
    billRequired: true
  },
  large: {
    projectCode: 'TEST-003',
    claimDate: new Date().toISOString(),
    expenses: Array.from({ length: 20 }, (_, i) => ({
      category: faker.helpers.arrayElement(['Travel', 'Food', 'Accommodation']),
      amount: faker.number.int({ min: 100, max: 5000 }),
      description: faker.lorem.sentence()
    })),
    billRequired: true
  }
};

/**
 * Create random claim
 */
export function createRandomClaim() {
  return {
    projectCode: `PROJ-${faker.string.alphanumeric(5).toUpperCase()}`,
    claimDate: faker.date.recent().toISOString(),
    employee_email: testUsers.employee.email,
    expenses: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
      category: faker.helpers.arrayElement(['Travel', 'Food', 'Accommodation', 'Other']),
      amount: faker.number.int({ min: 50, max: 5000 }),
      description: faker.lorem.sentence()
    })),
    billRequired: faker.datatype.boolean()
  };
}

/**
 * Create claim with specific status
 */
export function createClaimWithStatus(status: string) {
  return {
    ...createRandomClaim(),
    id: `claim-${faker.string.alphanumeric(8).toLowerCase()}`,
    status,
    created_at: faker.date.past().toISOString()
  };
}

/**
 * Mock Supabase response
 */
export function mockSupabaseResponse<T>(data: T, error: any = null) {
  return { data, error };
}

/**
 * Create test claim approval review
 */
export function createReviewData(claimId: string, approvedAmount: number) {
  return {
    claimId,
    remarks: 'Approved for payment',
    items: [
      {
        expenseId: `exp-${faker.string.alphanumeric(8)}`,
        approvedAmount: approvedAmount * 0.9,
        remarks: 'Slight reduction applied'
      }
    ]
  };
}

/**
 * Assertion helpers
 */
export const assertions = {
  /**
   * Assert claim has correct structure
   */
  isValidClaim(claim: any): boolean {
    return Boolean(
      claim.id &&
      claim.employee_email &&
      claim.status &&
      claim.created_at &&
      Array.isArray(claim.expenses)
    );
  },

  /**
   * Assert user has required fields
   */
  isValidUser(user: any): boolean {
    return Boolean(
      user.email &&
      user.name &&
      user.role &&
      ['User', 'Manager', 'Admin'].includes(user.role)
    );
  },

  /**
   * Assert transaction is valid
   */
  isValidTransaction(txn: any): boolean {
    return Boolean(
      txn.claim_id &&
      txn.amount &&
      txn.type &&
      ['credit', 'debit'].includes(txn.type) &&
      txn.description
    );
  },

  /**
   * Assert approval workflow state
   */
  isApprovalValid(approval: any): boolean {
    return Boolean(
      approval.claim_id &&
      approval.approver_email &&
      approval.status &&
      approval.timestamp
    );
  }
};

/**
 * Helper to create test database state
 */
export class TestDataBuilder {
  private claims: any[] = [];
  private users: any[] = [];
  private approvals: any[] = [];

  addUser(user: any) {
    this.users.push(user);
    return this;
  }

  addUsers(count: number) {
    for (let i = 0; i < count; i++) {
      this.users.push(createRandomUser());
    }
    return this;
  }

  addClaim(claim: any) {
    this.claims.push({
      id: `claim-${faker.string.alphanumeric(8)}`,
      ...claim,
      created_at: new Date().toISOString()
    });
    return this;
  }

  addClaims(count: number) {
    for (let i = 0; i < count; i++) {
      this.addClaim(createRandomClaim());
    }
    return this;
  }

  addApproval(approval: any) {
    this.approvals.push({
      id: `appr-${faker.string.alphanumeric(8)}`,
      ...approval,
      created_at: new Date().toISOString()
    });
    return this;
  }

  build() {
    return {
      users: this.users,
      claims: this.claims,
      approvals: this.approvals
    };
  }

  reset() {
    this.claims = [];
    this.users = [];
    this.approvals = [];
    return this;
  }
}

/**
 * Mock API responses
 */
export const mockResponses = {
  success: (data: any) => ({ ok: true, data }),
  error: (message: string) => ({ ok: false, message }),
  created: (data: any) => ({ ok: true, data, message: 'Created successfully' }),
  updated: (data: any) => ({ ok: true, data, message: 'Updated successfully' }),
  deleted: () => ({ ok: true, message: 'Deleted successfully' })
};

/**
 * Test claim workflow
 * Simulates complete claim journey
 */
export async function testClaimWorkflow(
  claimData: any,
  actions: {
    submit?: boolean;
    managerApprove?: boolean;
    adminApprove?: boolean;
    reject?: boolean;
  }
) {
  const results: any = {};
  const submittedClaim = {
    id: `claim-${faker.string.alphanumeric(8).toLowerCase()}`,
    employee_email: claimData.employee_email || testUsers.employee.email,
    status: 'Pending Manager Approval',
    created_at: new Date().toISOString(),
    expenses: claimData.expenses || [],
  };

  // Step 1: Submit claim
  if (actions.submit) {
    results.submitted = submittedClaim;
  }

  // Step 2: Manager approves
  if (actions.managerApprove) {
    results.managerApproved = {
      ...(results.submitted || submittedClaim),
      status: 'Pending Admin Approval',
    };
  }

  // Step 3: Admin approves
  if (actions.adminApprove) {
    results.adminApproved = {
      ...(results.managerApproved || results.submitted || submittedClaim),
      status: 'Approved',
    };
    results.transaction = {
      claim_id: results.adminApproved.id,
      amount: claimData.expenses.reduce((sum: number, e: any) => sum + e.amount, 0),
      type: 'credit',
      description: 'Claim settlement'
    };
  }

  // Alternative: Reject
  if (actions.reject) {
    results.rejected = {
      ...(results.submitted || submittedClaim),
      status: 'Rejected',
    };
  }

  return results;
}

/**
 * Performance test helper
 */
export async function measurePerformance(
  name: string,
  fn: () => Promise<any>,
  expectedMaxMs: number = 1000
) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  const passed = duration <= expectedMaxMs;
  console.log(
    `${passed ? '✅' : '❌'} ${name}: ${duration.toFixed(2)}ms (target: ${expectedMaxMs}ms)`
  );

  return { duration, passed, result };
}

/**
 * Batch performance test
 */
export async function measureBatchPerformance(
  tests: Array<{
    name: string;
    fn: () => Promise<any>;
    expectedMaxMs?: number;
  }>
) {
  const results = await Promise.all(
    tests.map(test =>
      measurePerformance(test.name, test.fn, test.expectedMaxMs || 1000)
    )
  );

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const allPassed = results.every(r => r.passed);

  console.log(
    `\n📊 Batch Results: ${allPassed ? '✅ All passed' : '❌ Some failed'}`
  );
  console.log(`Average duration: ${avgDuration.toFixed(2)}ms`);

  return { results, avgDuration, allPassed };
}

/**
 * Export all utilities
 */
export default {
  testUsers,
  testClaims,
  createRandomUser,
  createRandomClaim,
  createClaimWithStatus,
  createReviewData,
  mockSupabaseResponse,
  assertions,
  TestDataBuilder,
  mockResponses,
  testClaimWorkflow,
  measurePerformance,
  measureBatchPerformance
};

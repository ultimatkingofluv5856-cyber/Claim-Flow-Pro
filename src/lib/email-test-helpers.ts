/**
 * Browser Console Test Helper
 * 
 * Add this to your app to test email directly from browser console
 * 
 * In browser DevTools console, run:
 *   await testSendEmail('test@example.com', 'user_created', { name: 'Test' })
 */

// Make test function globally available (only in dev)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).testSendEmail = async (
    email: string,
    type: string = 'user_created',
    data: Record<string, any> = {}
  ) => {
    console.log('\n🧪 Testing send-notification Edge Function');
    console.log('━'.repeat(50));
    
    try {
      // Import here to avoid circular dependencies
      const { supabase } = await import('@/integrations/supabase/client');
      
      const requestBody = {
        type,
        recipientEmail: email,
        data: {
          name: data.name || 'Test User',
          ...data,
        },
      };
      
      console.log('📤 Request:');
      console.table(requestBody);
      
      console.log('\n⏳ Sending email via Edge Function...');
      // Use Supabase SDK's functions.invoke() - handles JWT properly
      const { data: response, error } = await supabase.functions.invoke('send-notification', {
        body: requestBody,
      });

      if (error) {
        console.error('❌ ERROR:');
        console.error('  Message:', error.message);
        console.error('  Details:', error);
        return { success: false, error: error };
      } else {
        console.log('✅ SUCCESS:');
        console.table(response);
        console.log('\n📧 Email sent! Check inbox for:', email);
        return { success: true, data: response };
      }
    } catch (err: any) {
      console.error('❌ EXCEPTION:');
      console.error('  Message:', err.message);
      console.error('  Stack:', err.stack);
      return { success: false, error: err };
    }
  };

  // Also provide quick test commands
  (window as any).quickEmailTests = {
    async testUserCreated() {
      return (window as any).testSendEmail('test@example.com', 'user_created', {
        name: 'John Doe',
        role: 'Manager',
        advance: 5000,
        companyName: 'ClaimFlow Pro',
        currencySymbol: '₹',
      });
    },

    async testClaimSubmitted() {
      return (window as any).testSendEmail('test@example.com', 'claim_submitted', {
        employeeName: 'John Doe',
        claimAmount: 5000,
        claimDate: new Date().toLocaleDateString(),
        description: 'Travel expenses',
        claimId: 'CLM-001',
        companyName: 'ClaimFlow Pro',
        currencySymbol: '₹',
      });
    },

    async testClaimApproved() {
      return (window as any).testSendEmail('test@example.com', 'claim_approved', {
        employeeName: 'John Doe',
        claimAmount: 5000,
        claimId: 'CLM-001',
        companyName: 'ClaimFlow Pro',
        currencySymbol: '₹',
      });
    },

    async testClaimRejected() {
      return (window as any).testSendEmail('test@example.com', 'claim_rejected', {
        employeeName: 'John Doe',
        claimAmount: 5000,
        claimId: 'CLM-001',
        reason: 'Missing receipts',
        companyName: 'ClaimFlow Pro',
        currencySymbol: '₹',
      });
    },
  };

  console.log('✅ Email test helpers loaded!');
  console.log('📚 Available commands in browser console:');
  console.log('   testSendEmail(email, type, data)');
  console.log('   quickEmailTests.testUserCreated()');
  console.log('   quickEmailTests.testClaimSubmitted()');
  console.log('   quickEmailTests.testClaimApproved()');
  console.log('   quickEmailTests.testClaimRejected()');
}

export {};

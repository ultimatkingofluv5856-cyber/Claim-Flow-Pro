/**
 * Supabase Debug Utility
 * Use this to diagnose issues with Supabase client initialization and Edge Function calls
 */

export function debugSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const debugInfo = {
    urlAvailable: !!url,
    anonKeyAvailable: !!anonKey,
    urlValue: url || 'NOT SET',
    anonKeyPreview: anonKey ? anonKey.substring(0, 20) + '...' : 'NOT SET',
    projectId: new URL(url || 'https://example.com').hostname.split('.')[0],
    isProduction: !import.meta.env.DEV,
  };

  console.log('🔍 Supabase Client Debug Information:');
  console.table(debugInfo);

  if (!url) {
    console.error('❌ VITE_SUPABASE_URL is not set');
  }

  if (!anonKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY is not set');
  }

  if (url && anonKey) {
    console.log('✅ Both required environment variables are configured');
  }

  return debugInfo;
}

export function debugEdgeFunctionCall(
  functionName: string,
  requestBody: any,
  response: { data: any; error: any }
) {
  console.log(`\n🔍 Edge Function Call Debug: ${functionName}`);
  console.log('📤 Request Body:');
  console.table(requestBody);

  if (response.error) {
    console.error('❌ Error Response:');
    console.table(response.error);
    console.log('Full error object:', response.error);
  } else {
    console.log('✅ Success Response:');
    console.table(response.data);
  }
}

export async function testEdgeFunctionConnection(supabase: any) {
  console.log('\n🧪 Testing Edge Function Connection...');
  
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: {
        type: 'user_created',
        recipientEmail: 'test@example.com',
        data: {
          name: 'Debug Test',
        },
      },
    });

    if (error) {
      console.error('❌ Connection test failed:');
      console.error('  Status:', error.status);
      console.error('  Message:', error.message);
      return false;
    } else {
      console.log('✅ Connection test successful');
      console.log('  Response:', data);
      return true;
    }
  } catch (err: any) {
    console.error('❌ Connection test threw error:');
    console.error('  Error:', err.message);
    console.error('  Stack:', err.stack);
    return false;
  }
}

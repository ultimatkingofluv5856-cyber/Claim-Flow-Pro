import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function EmailTestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      console.log('📧 Invoking send-notification function...');
      console.log('   Recipient:', email.trim());
      console.log('   Type: user_created');
      
      const requestBody = {
        type: 'user_created',
        recipientEmail: email.trim(),
        data: {
          name: 'Test User',
          role: 'Manager',
          advance: 5000,
          companyName: 'ClaimFlow Pro',
          currencySymbol: '₹',
        },
      };
      
      console.log('   Request body:', JSON.stringify(requestBody, null, 2));

      // Use Supabase SDK's functions.invoke() - handles JWT properly
      const { data, error: fnError } = await supabase.functions.invoke('send-notification', {
        body: requestBody,
      });

      if (fnError) {
        console.error('❌ Function error:', fnError);
        setError(`Error: ${fnError.message || 'Email send failed'}`);
      } else {
        console.log('✅ Success response:', data);
        setMessage(`✅ Test email sent successfully to ${email}. Check your inbox in 30 seconds.`);
        setEmail('');
      }
    } catch (err: any) {
      console.error('❌ Catch error:', err);
      console.error('   Error type:', err.constructor.name);
      console.error('   Error details:', JSON.stringify(err, null, 2));
      setError(`Failed to send email: ${err.message || JSON.stringify(err)}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto mt-10">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Mail className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Email Test</h1>
          </div>
          
          <form onSubmit={handleTestEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Test Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="test@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {message}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">Test Email Details:</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Type: User Account Created</li>
              <li>• Name: Test User</li>
              <li>• Role: Manager</li>
              <li>• Advance: ₹5,000</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

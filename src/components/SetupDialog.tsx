import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Key, Shield, AlertCircle, ExternalLink } from 'lucide-react';

interface SetupDialogProps {
  onComplete: () => void;
}

export const SetupDialog: React.FC<SetupDialogProps> = ({ onComplete }) => {
  const [clientId, setClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    // Load any existing client ID from storage
    chrome.storage.local.get(['googleClientId']).then((result) => {
      if (result.googleClientId) {
        setClientId(result.googleClientId);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!clientId.trim()) {
      setError('Client ID is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save client ID to Chrome storage
      await chrome.storage.local.set({ googleClientId: clientId.trim() });
      console.log('Google Client ID saved successfully');
      onComplete();
    } catch (error) {
      console.error('Failed to save Client ID:', error);
      setError('Failed to save Client ID. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipSetup = () => {
    console.log('User skipped Google Drive setup');
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Google Drive Setup
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-blue-900 font-medium mb-1">
                  Enable Google Drive Integration
                </p>
                <p className="text-blue-700">
                  Connect your Google Drive to save recordings and notes directly to organized folders.
                  The Client ID below is stored locally and used only for API authentication.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="client-id" className="block text-sm font-medium text-gray-700 mb-1">
                Google Client ID
              </label>
              <Input
                id="client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your Google OAuth Client ID"
                className="w-full"
                required
              />
              {error && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>

            {showAdvanced && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Setup Instructions</h3>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Create a new project or select existing one</li>
                  <li>Enable Google Drive API</li>
                  <li>Create OAuth 2.0 credentials for Chrome Extension</li>
                  <li>Copy the Client ID and paste it above</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showAdvanced ? 'Hide' : 'Show'} setup instructions
            </button>
          </form>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={skipSetup}
            disabled={isSubmitting}
            className="order-2 sm:order-1"
          >
            Skip for now
          </Button>

          <div className="flex gap-3 order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open('/GOOGLE_DRIVE_SETUP.md', '_blank')}
            >
              Guide
            </Button>

            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || !clientId.trim()}
              className="min-w-[100px]"
            >
              {isSubmitting ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
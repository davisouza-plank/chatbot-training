"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { createClient } from '@/utils/supabase/client';
import { toast } from "sonner";

interface WizardSettings {
  merlin_temperature: number;
  tempest_temperature: number;
  chronicle_temperature: number;
}

export function WizardSettings() {
  const [settings, setSettings] = useState<WizardSettings>({
    merlin_temperature: 0.7,
    tempest_temperature: 0.5,
    chronicle_temperature: 0.3
  });

  const supabase = createClient();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_uuid', session.user.id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Record not found error
        toast.error('Failed to load settings');
      }
      return;
    }

    if (data) {
      setSettings(data);
    }
  };

  const handleTemperatureChange = async (wizard: keyof WizardSettings, value: number) => {
    const newSettings = { ...settings, [wizard]: value };
    setSettings(newSettings);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_uuid: session.user.id,
        ...newSettings
      });

    if (error) {
      toast.error('Failed to save settings');
      return;
    }

    toast.success('Settings saved successfully');
  };

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle className="font-unzialish text-2xl">🎭 Wizard Personalities</CardTitle>
        <CardDescription className="font-mysticora">
          Adjust how creative each wizard should be in their responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="font-alchemist text-blue-300">
            Merlin's Wisdom (Temperature: {settings.merlin_temperature})
          </Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.merlin_temperature}
            onChange={(e) => handleTemperatureChange('merlin_temperature', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground font-quickquill">
            Higher values make Merlin more creative and whimsical
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-alchemist text-emerald-300">
            Tempest's Energy (Temperature: {settings.tempest_temperature})
          </Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.tempest_temperature}
            onChange={(e) => handleTemperatureChange('tempest_temperature', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground font-quickquill">
            Higher values make Tempest more dynamic in weather descriptions
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-alchemist text-amber-300">
            Chronicle's Style (Temperature: {settings.chronicle_temperature})
          </Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.chronicle_temperature}
            onChange={(e) => handleTemperatureChange('chronicle_temperature', parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground font-quickquill">
            Higher values make Chronicle more elaborate in news reporting
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 
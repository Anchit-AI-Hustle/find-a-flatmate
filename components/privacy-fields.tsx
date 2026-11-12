export function PrivacyFields({ discoverable, analytics, reminders }: { discoverable: boolean; analytics: boolean; reminders: boolean }) {
  return (
    <div className="checks" style={{ marginBottom: 16 }}>
      <label className="check"><input type="checkbox" name="discoverable" defaultChecked={discoverable} /><span><strong>Show my profile in Discover.</strong><br /><span className="hint">Turn off to browse quietly. People you’ve matched with can still see you.</span></span></label>
      <label className="check"><input type="checkbox" name="analytics" defaultChecked={analytics} /><span><strong>Help improve matching by sharing usage events.</strong><br /><span className="hint">Optional. Stored against your account, first-party only: the step you reached, your city and intent. No ad trackers. Deleted if you close your account.</span></span></label>
      <label className="check"><input type="checkbox" name="reminders" defaultChecked={reminders} /><span><strong>Remind me about expiring listings and upcoming visits.</strong><br /><span className="hint">Optional. Reminders are not being sent yet; this saves your choice for when they are.</span></span></label>
    </div>
  );
}

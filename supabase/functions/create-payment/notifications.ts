export async function scheduleNotifications(appointmentId: string, supabase: any) {
  console.log('\ud83d\udcc5 Scheduling notifications for appointment:', appointmentId);

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', appointmentId)
    .single();

  if (appointmentError || !appointment) {
    console.error('\u274c Error fetching appointment:', appointmentError);
    return;
  }

  const appointmentDate = new Date(appointment.scheduled_date);
  const now = new Date();

  const notifications = [];

  const oneWeekBefore = new Date(appointmentDate);
  oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
  if (oneWeekBefore > now) {
    notifications.push({
      appointment_id: appointmentId,
      notification_type: 'week_before',
      scheduled_for: oneWeekBefore.toISOString(),
      status: 'pending'
    });
  }

  const threeDaysBefore = new Date(appointmentDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
  if (threeDaysBefore > now) {
    notifications.push({
      appointment_id: appointmentId,
      notification_type: 'three_days_before',
      scheduled_for: threeDaysBefore.toISOString(),
      status: 'pending'
    });
  }

  const oneDayBefore = new Date(appointmentDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  if (oneDayBefore > now) {
    notifications.push({
      appointment_id: appointmentId,
      notification_type: 'day_before',
      scheduled_for: oneDayBefore.toISOString(),
      status: 'pending'
    });
  }

  const threeHoursBefore = new Date(appointmentDate);
  threeHoursBefore.setHours(threeHoursBefore.getHours() - 3);
  if (threeHoursBefore > now) {
    notifications.push({
      appointment_id: appointmentId,
      notification_type: 'three_hours_before',
      scheduled_for: threeHoursBefore.toISOString(),
      status: 'pending'
    });
  }

  if (notifications.length > 0) {
    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.error('\u274c Error inserting notifications:', notifError);
    } else {
      console.log(`\u2705 Scheduled ${notifications.length} notifications`);
    }
  }
}
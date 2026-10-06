"use client";

import { useEffect, useState, useCallback, use } from "react";
import {
  getShipmentByIdAction,
  updateShipmentStatusAction,
  initiateShipmentPhotoUploadAction, confirmShipmentPhotoUploadAction,
  removeShipmentPhotoAction,
  sendShippingFeeReminderAction,
  getShipmentEmailLogsAction,
} from "@/app/actions";
import { setShippingFeeAction } from "@/app/actions/admin-payments";
import { Shipment } from "@/lib/db";
import { ShipmentStatusBadge, STATUS_ORDER, ShipmentStatus, ShipmentTimeline, SHIPMENT_STATUS_ADMIN_LABELS } from "@/components/shipment-status";
import { ArrowLeft, Save, MapPin, Calendar, Camera, X, UploadCloud, AlertCircle, Clock, DollarSign, Plus, Mail, Send, CheckCircle2 } from "lucide-react";
import { AddTrackingEventDrawer } from "@/components/drawers/add-tracking-event-drawer";
import Link from "next/link";

export default function AdminShipmentDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);

  // Timeline update form
  const [newStatus, setNewStatus] = useState<ShipmentStatus>("SHIPMENT_CREATED");

  const [newLocation, setNewLocation] = useState("");
  const [newNote, setNewNote] = useState("");
  const [updatingTimeline, setUpdatingTimeline] = useState(false);

  // Real file upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Shipping fee state
  const [feeInput, setFeeInput] = useState<string>("");
  const [updatingFee, setUpdatingFee] = useState(false);
  const [feeMessage, setFeeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Email notifications state
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [found, logs] = await Promise.all([
        getShipmentByIdAction(id),
        getShipmentEmailLogsAction(id).catch(() => []),
      ]);
      if (found) {
        setShipment(found);
        setNewStatus(found.status);
        setFeeInput(found.fee > 0 ? String(found.fee) : "");
      }
      setEmailLogs(logs || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [id]);

  const handleSendReminder = async () => {
    if (!shipment) return;
    setSendingReminder(true);
    setReminderFeedback(null);
    try {
      const res = await sendShippingFeeReminderAction(id);
      if (res?.error) {
        setReminderFeedback({ type: "error", text: res.error });
      } else {
        setReminderFeedback({ type: "success", text: res?.message || "Reminder sent successfully." });
        const freshLogs = await getShipmentEmailLogsAction(id).catch(() => []);
        setEmailLogs(freshLogs);
      }
    } catch (err: any) {
      setReminderFeedback({ type: "error", text: err?.message || "Failed to send reminder." });
    } finally {
      setSendingReminder(false);
    }
  };

  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(feeInput);
    if (isNaN(parsed) || parsed < 0) {
      setFeeMessage({ type: "error", text: "Please enter a valid fee amount." });
      return;
    }
    setUpdatingFee(true);
    setFeeMessage(null);
    const result = await setShippingFeeAction(id, parsed);
    if ("error" in result && result.error) {
      setFeeMessage({ type: "error", text: result.error });
    } else {
      setFeeMessage({ type: "success", text: `Fee updated to GHS ${parsed.toFixed(2)}` });
      await loadData();
    }
    setUpdatingFee(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment) return;
    setUpdatingTimeline(true);
    await updateShipmentStatusAction(id, newStatus, newNote, newLocation);
    await loadData();
    setNewLocation("");
    setNewNote("");
    setUpdatingTimeline(false);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
    const initResult = await initiateShipmentPhotoUploadAction(id, selectedFile.name, selectedFile.type, selectedFile.size);
      if ("error" in initResult && initResult.error) {
        setUploadError(initResult.error);
        setUploading(false);
        return;
      }

      if (!initResult.signedUrl || !initResult.token || !initResult.objectPath) {
        setUploadError("Invalid upload authorization received.");
        setUploading(false);
        return;
      }

            await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", initResult.signedUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${initResult.token}`);
        xhr.setRequestHeader("Content-Type", selectedFile.type || "application/octet-stream");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Direct storage upload failed with status " + xhr.status));
          }
        };

        xhr.onerror = () => reject(new Error("Direct storage upload failed. Please check your connection."));
        xhr.send(selectedFile);
      });

      const confirmResult = await confirmShipmentPhotoUploadAction(
        id, 
        initResult.objectPath, 
        selectedFile.name, 
        selectedFile.type, 
        selectedFile.size
      );

      if ("error" in confirmResult && confirmResult.error) {
        setUploadError(confirmResult.error);
      } else {
        setSelectedFile(null);
        // Reset file input element if needed
        const fileInput = document.getElementById("shipment-file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        await loadData();
      }
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    await removeShipmentPhotoAction(id, photoId);
    await loadData();
  };

  if (loading) return <div className="p-6 sm:p-10 text-center text-sm font-semibold text-[#667085]">Loading shipment details...</div>;
  if (!shipment) return <div className="p-6 sm:p-10 text-center text-sm font-semibold text-[#667085]">Shipment not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/admin/shipments" className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#172236] transition-colors">
        <ArrowLeft size={16} /> Back to Shipments
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-[#E5E7EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#172236]">{shipment.id}</h1>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">{shipment.description} · Customer: <span className="font-semibold text-[#172236]">{shipment.customerId}</span></p>
        </div>
        <div className="flex items-center gap-3 bg-[#F7F9FC] px-3 sm:px-4 py-2 rounded-xl border border-[#E5E7EB]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">Current Status</span>
          <ShipmentStatusBadge status={shipment.status} adminMode />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Details & Photos */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[#E5E7EB]">
            <h2 className="text-base sm:text-lg font-bold text-[#172236] mb-5">Shipment Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Origin</p>
                <p className="font-semibold text-sm text-[#172236] flex items-center gap-1.5"><MapPin size={14} className="text-[#94A3B8]"/> {shipment.origin}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Destination</p>
                <p className="font-semibold text-sm text-[#172236] flex items-center gap-1.5"><MapPin size={14} className="text-[#94A3B8]"/> {shipment.destination}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Shipping Method</p>
                <p className="font-semibold text-sm text-[#172236]">{shipment.shippingMethod}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Estimated Arrival</p>
                <p className="font-semibold text-sm text-[#10B981] flex items-center gap-1.5"><Calendar size={14} className="text-[#10B981]"/> {shipment.estimatedArrival}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Batch Assignment</p>
                <p className="font-semibold text-sm text-[#172236]">{shipment.batch || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Shipping Fee</p>
                <p className="font-semibold text-sm text-[#172236]">GHS {shipment.fee.toFixed(2)}</p>
              </div>
            </div>

            {/* Shipping fee editor */}
            <form onSubmit={handleUpdateFee} className="mt-6 pt-5 border-t border-[#F1F5F9] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#172236] flex items-center gap-2">
                  <DollarSign size={15} className="text-[#667085]" /> Set / Update Shipping Fee
                </h3>
                {shipment.fee > 0 && (
                  <button
                    type="button"
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#141B47] text-white hover:bg-[#202B6D] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Mail size={13} />
                    {sendingReminder ? "Sending..." : "Send Fee Statement Email"}
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#667085]">GHS</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                    className="w-full pl-12 pr-4 h-10 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 transition-colors bg-white"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingFee}
                  className="px-5 h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "#0B1F44", color: "white" }}
                >
                  {updatingFee ? "Saving..." : <><Save size={14} /> Save Fee</>}
                </button>
              </div>
              {feeMessage && (
                <p className={`text-xs font-medium ${feeMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {feeMessage.text}
                </p>
              )}
              {reminderFeedback && (
                <p className={`text-xs font-medium ${reminderFeedback.type === "success" ? "text-emerald-600" : "text-amber-600"}`}>
                  {reminderFeedback.text}
                </p>
              )}
            </form>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-[#E5E7EB]">
            <h2 className="text-base sm:text-lg font-bold text-[#172236] mb-2 flex items-center gap-2"><Camera size={18} /> Cargo Photos</h2>
            <p className="text-xs text-[#667085] mb-5">Upload warehouse, packing, and condition photos.</p>
            
            {/* Batch Closure / 7-Day Retention Notice */}
            {shipment.batchStatus === "CLOSED" ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <Clock size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900">Batch Closed · 7-Day Retention Active</p>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    This batch has been marked closed. Shipment files are temporarily preserved and will be permanently deleted after the 7-day retention period expires. File uploads are frozen.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFileUpload} className="space-y-3 mb-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    id="shipment-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setUploadError(null);
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0B1F44] file:text-white hover:file:opacity-90 cursor-pointer"
                  />
                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="px-5 h-10 text-sm font-bold rounded-xl bg-[#0B1F44] text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 transition-all shadow-sm"
                  >
                    {uploading ? (uploadProgress === 100 ? "Upload complete" : "Uploading... " + uploadProgress + "%") : <><UploadCloud size={16} /> Upload Photo</>}
                  </button>
                </div>

                {selectedFile && (
                  <p className="text-xs text-[#667085]">
                    Selected: <strong className="text-[#172236]">{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}

                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </form>
            )}

            {shipment.photos.length === 0 ? (
              <div className="p-6 sm:p-8 border-2 border-dashed border-[#E5E7EB] rounded-xl text-center">
                <p className="text-sm text-[#667085] font-medium">No photos uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {shipment.photos.map(p => (
                  <div key={p.id} className="relative group rounded-xl overflow-hidden border border-[#E5E7EB] aspect-square bg-gray-100">
                    <img src={p.url} alt="Cargo" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => handleRemovePhoto(p.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-white/90 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Timeline Management */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#172236]">Update Tracking</h2>
              <button
                type="button"
                onClick={() => setIsEventDrawerOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} /> Open Drawer
              </button>
            </div>
            
            {/* Add Tracking Event Drawer */}
            <AddTrackingEventDrawer
              isOpen={isEventDrawerOpen}
              onClose={() => setIsEventDrawerOpen(false)}
              shipmentId={shipment.id}
              currentStatus={shipment.status}
              onSuccess={loadData}
            />
            
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236]">New Status</label>
                <select 
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as ShipmentStatus)}
                  className="w-full px-3 h-10 rounded-lg text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB]"
                >
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{SHIPMENT_STATUS_ADMIN_LABELS[s]}</option>)}
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236]">Location (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. Tema Port, Ghana"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className="w-full px-3 h-10 rounded-lg text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236]">Internal/Public Note (Optional)</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Cleared customs, preparing for warehouse transit."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="w-full p-3 rounded-lg text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={updatingTimeline}
                className="w-full h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm bg-[#FFB800] text-[#07182F] disabled:opacity-50"
              >
                <Save size={16} /> {updatingTimeline ? "Saving..." : "Add Event to Timeline"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
            <h2 className="text-lg font-bold text-[#172236] mb-5">Timeline Preview</h2>
            <div className="max-h-[400px] overflow-y-auto pr-2">
              <ShipmentTimeline currentStatus={shipment.status} events={shipment.trackingEvents} adminMode />
            </div>
          </div>

          {/* Email Notification History */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#172236] flex items-center gap-2">
                <Mail size={15} className="text-[#141B47]" /> Brevo Email History
              </h2>
              <span className="text-[11px] font-semibold text-[#667085]">
                {emailLogs.length} event(s)
              </span>
            </div>
            
            {emailLogs.length === 0 ? (
              <p className="text-xs text-[#667085] py-2">No email notifications sent for this shipment yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {emailLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#141B47] uppercase text-[10px] tracking-wider">
                        {log.eventType.replace(/_/g, " ")}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        log.status === "SENT"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : log.status === "FAILED"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] truncate">To: {log.recipient}</p>
                    <p className="text-[10px] text-[#94A3B8]">
                      {log.sentAt ? `Sent on ${new Date(log.sentAt).toLocaleString()}` : new Date(log.createdAt).toLocaleString()}
                    </p>
                    {log.errorMessage && (
                      <p className="text-[10px] text-red-600 font-medium">{log.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

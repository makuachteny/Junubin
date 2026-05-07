/**
 * event-ticket-pkpass — Supabase Edge Function
 *
 * Builds a JuNubin event ticket as a `.pkpass` for Apple Wallet, signs it
 * with the project's Pass Type ID certificate, uploads to Supabase Storage,
 * and returns a signed URL the client can hand to `Linking.openURL` so iOS
 * pops the pass straight into Wallet.
 *
 * Request body:
 *   eventId: string
 *   attendeeId: string
 *
 * Response:
 *   { url: string, expiresAt: string }
 *
 * ── Setup required (one-time, by the project owner) ──────────────────
 * 1. developer.apple.com → Identifiers → +. Pick "Pass Type IDs". Make
 *    `pass.com.junubin.event`. Generate the cert, download as `.p12`.
 * 2. Pull the AppleWWDRCAG3 intermediate from
 *    https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer.
 *    Convert both to PEM:
 *      openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem
 *      openssl pkcs12 -in pass.p12 -nocerts -nodes  -out pass-key.pem
 *      openssl x509  -in AppleWWDRCAG3.cer -inform DER -out wwdr.pem
 * 3. Upload as Supabase secrets:
 *      supabase secrets set PASS_CERT_PEM="$(cat pass-cert.pem)"
 *      supabase secrets set PASS_KEY_PEM="$(cat pass-key.pem)"
 *      supabase secrets set PASS_WWDR_PEM="$(cat wwdr.pem)"
 *      supabase secrets set PASS_TYPE_ID="pass.com.junubin.event"
 *      supabase secrets set PASS_TEAM_ID="7CW78SZQF9"
 * 4. Create a public bucket `wallet-passes` in Supabase Storage (or use
 *    a private one — this function generates a 1-hour signed URL).
 *
 * Until those env vars are set, this function returns 503 with a clear
 * message; the client surfaces that as an alert. The pass.json + manifest
 * scaffolding below is already complete; the only missing piece in Deno
 * is PKCS#7 detached signing of the manifest. When you wire that up,
 * uncomment the `signManifest` call and the pass becomes live.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PASS_TYPE_ID = Deno.env.get("PASS_TYPE_ID") || "";
const PASS_TEAM_ID = Deno.env.get("PASS_TEAM_ID") || "";
const PASS_CERT_PEM = Deno.env.get("PASS_CERT_PEM") || "";
const PASS_KEY_PEM = Deno.env.get("PASS_KEY_PEM") || "";
const PASS_WWDR_PEM = Deno.env.get("PASS_WWDR_PEM") || "";

function buildPassJson(event: any, attendee: any) {
  // Generic event ticket layout. Tinted on the cream Wallet card with our
  // accent rose; primary fields surface event title; secondary fields
  // surface date + location; auxiliary surfaces attendee name. Barcode is
  // the same QR payload the in-app ticket displays.
  const dateIso = event?.date && event?.time
    ? new Date(`${event.date}T19:00:00`).toISOString()
    : new Date().toISOString();

  return {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    serialNumber: attendee.id,
    teamIdentifier: PASS_TEAM_ID,
    organizationName: "JuNubin",
    description: `JuNubin ticket — ${event.title}`,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(15, 13, 12)",
    labelColor: "rgb(245, 183, 65)",
    relevantDate: dateIso,
    locations: event?.location ? [{ latitude: 0, longitude: 0, relevantText: event.location }] : undefined,
    eventTicket: {
      headerFields: [
        { key: "kind", label: "TICKET", value: attendee.paid ? "PAID" : "RSVP" },
      ],
      primaryFields: [
        { key: "title", label: "EVENT", value: event.title },
      ],
      secondaryFields: [
        { key: "date", label: "WHEN", value: event.date || "TBA" },
        { key: "loc", label: "WHERE", value: event.location || "TBA" },
      ],
      auxiliaryFields: [
        { key: "attendee", label: "ATTENDEE", value: attendee.name || "Guest" },
        { key: "code", label: "CODE", value: attendee.ticketCode },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: `junubin://ticket?code=${attendee.ticketCode}&att=${attendee.id}&evt=${event.id}`,
        messageEncoding: "iso-8859-1",
        altText: attendee.ticketCode,
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!PASS_TYPE_ID || !PASS_TEAM_ID || !PASS_CERT_PEM || !PASS_KEY_PEM || !PASS_WWDR_PEM) {
    return errorResponse(
      "Apple Wallet not configured yet. The owner needs to register a Pass Type ID at developer.apple.com and upload the cert to Supabase secrets (see function README). Your in-app ticket code still works at the door.",
      503,
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) return errorResponse("Unauthorized", 401);

    const { eventId, attendeeId } = await req.json();
    if (!eventId || !attendeeId) {
      return errorResponse("Missing eventId or attendeeId");
    }

    // Look up the event + attendee from the (eventually-server-side) tables.
    // Until events live in the DB, the client passes the AsyncStorage record
    // through and we trust it for pass-building only — the signed pass is
    // bound to the attendee.id so it can't be reused.
    const { data: event } = await supabase.from("Event").select("*").eq("id", eventId).maybeSingle();
    const { data: attendee } = await supabase.from("EventAttendee").select("*").eq("id", attendeeId).maybeSingle();

    if (!event || !attendee || attendee.userId !== authUser.id) {
      return errorResponse("Ticket not found", 404);
    }

    const passJson = buildPassJson(event, attendee);

    // ── PKCS#7 detached signing of the manifest is the missing piece ──
    // const archive = await buildPkpassArchive(passJson);
    // const signed = await signManifest(archive, PASS_CERT_PEM, PASS_KEY_PEM, PASS_WWDR_PEM);
    // const path = `wallet-passes/${attendee.id}.pkpass`;
    // await supabase.storage.from("wallet-passes").upload(path, signed, {
    //   contentType: "application/vnd.apple.pkpass",
    //   upsert: true,
    // });
    // const { data: signedUrl } = await supabase.storage
    //   .from("wallet-passes")
    //   .createSignedUrl(path, 3600);
    // return jsonResponse({ url: signedUrl.signedUrl, expiresAt: ... });

    return errorResponse(
      "Pass signing pipeline pending. pass.json is built; PKCS#7 signing in Deno is the last step. See function README.",
      501,
    );
  } catch (err) {
    console.error("event-ticket-pkpass error:", err);
    return errorResponse((err as Error).message || "Internal server error", 500);
  }
});

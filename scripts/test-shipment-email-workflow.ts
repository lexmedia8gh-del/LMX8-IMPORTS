import {
  SHIPMENT_EMAIL_EVENTS,
  isBrevoEmailMilestone,
  getMilestoneEmailSubject,
  generateMilestoneEmailHtml,
  BrevoMilestone,
} from "../src/lib/email/brevo";
import { ShipmentStatus } from "../src/components/shipment-status";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✓ ${msg}`);
}

async function runTests() {
  console.log("=== RUNNING SHIPMENT TIMELINE & BREVO EMAIL AUTOMATION TESTS ===\n");

  // Test 1: Verify all 6 milestones are correctly mapped in SHIPMENT_EMAIL_EVENTS
  const expectedEvents: Record<string, string> = {
    SHIPMENT_CREATED: "SHIPMENT_ORDER_CONFIRMED",
    PREPARING_SHIPMENT: "SHIPMENT_PREPARING",
    SHIPPED: "SHIPMENT_DEPARTED_CHINA",
    IN_TRANSIT: "SHIPMENT_IN_TRANSIT",
    ARRIVED_AT_DESTINATION: "SHIPMENT_ARRIVED_GHANA",
    CUSTOMS_CLEARANCE: "SHIPMENT_CUSTOMS_CLEARANCE",
  };

  for (const [status, event] of Object.entries(expectedEvents)) {
    assert(
      SHIPMENT_EMAIL_EVENTS[status as ShipmentStatus] === event,
      `Status '${status}' maps to event '${event}'`
    );
    assert(
      isBrevoEmailMilestone(status),
      `isBrevoEmailMilestone('${status}') returns true`
    );
  }

  // Test 2: Verify non-triggering stages return null / false
  assert(
    SHIPMENT_EMAIL_EVENTS.OUT_FOR_DELIVERY === null,
    "OUT_FOR_DELIVERY does NOT trigger automated email (mapped to null)"
  );
  assert(
    !isBrevoEmailMilestone("OUT_FOR_DELIVERY"),
    "isBrevoEmailMilestone('OUT_FOR_DELIVERY') returns false"
  );
  assert(
    SHIPMENT_EMAIL_EVENTS.DELIVERED === null,
    "DELIVERED does NOT trigger automated email (mapped to null)"
  );
  assert(
    !isBrevoEmailMilestone("DELIVERED"),
    "isBrevoEmailMilestone('DELIVERED') returns false"
  );
  assert(
    SHIPMENT_EMAIL_EVENTS.ON_HOLD === null,
    "ON_HOLD does NOT trigger automated email (mapped to null)"
  );

  // Test 3: Verify Subjects for all 6 events
  const s1 = getMilestoneEmailSubject("SHIPMENT_CREATED", "Consignment");
  assert(s1 === "Your LMX8 IMPORTS shipment has been confirmed", `Order Confirmed subject: '${s1}'`);

  const s2 = getMilestoneEmailSubject("PREPARING_SHIPMENT", "Batch 101");
  assert(s2.includes("Your shipment is being prepared"), `Preparing for Shipment subject: '${s2}'`);

  const s3 = getMilestoneEmailSubject("SHIPPED", "Batch 101");
  assert(s3.includes("Your shipment has departed China"), `Departed China subject: '${s3}'`);

  const s4 = getMilestoneEmailSubject("IN_TRANSIT", "Batch 101");
  assert(s4.includes("Your shipment is on the way to Ghana"), `On the Way to Ghana subject: '${s4}'`);

  // Test 4: Arrived in Ghana - Paid vs Unpaid fee condition
  const s5Unpaid = getMilestoneEmailSubject("ARRIVED_AT_DESTINATION", "Batch 101", true);
  assert(
    s5Unpaid === "Your shipment has arrived in Ghana — shipping fee outstanding",
    `Arrived in Ghana (Unpaid) subject: '${s5Unpaid}'`
  );

  const s5Paid = getMilestoneEmailSubject("ARRIVED_AT_DESTINATION", "Batch 101", false);
  assert(
    s5Paid.includes("Your shipment has arrived in Ghana") && !s5Paid.includes("outstanding"),
    `Arrived in Ghana (Paid) subject: '${s5Paid}'`
  );

  // Test 5: Customs Clearance - Paid vs Unpaid fee condition
  const s6Unpaid = getMilestoneEmailSubject("CUSTOMS_CLEARANCE", "Batch 101", true);
  assert(
    s6Unpaid === "Your shipment is undergoing customs clearance — action required",
    `Customs Clearance (Unpaid) subject: '${s6Unpaid}'`
  );

  const s6Paid = getMilestoneEmailSubject("CUSTOMS_CLEARANCE", "Batch 101", false);
  assert(
    s6Paid.includes("Your shipment is currently undergoing customs clearance") && !s6Paid.includes("action required"),
    `Customs Clearance (Paid) subject: '${s6Paid}'`
  );

  // Test 6: Verify HTML Generation for Customs Clearance with Unpaid Shipping Fee
  const htmlUnpaid = generateMilestoneEmailHtml({
    customerName: "Kofi Mensah",
    customerIdentifier: "LMX-001",
    batchDisplay: "AIR-CARGO-BATCH-04",
    trackingNumber: "SHP-998822",
    description: "Industrial Electronics & Spares",
    milestone: "CUSTOMS_CLEARANCE",
    statusDate: "Oct 7, 2026",
    portalUrl: "https://lmx8imports.com/portal/shipments/SHP-998822",
    isShippingFeeUnpaid: true,
    totalShippingFee: 450.00,
    amountPaid: 0,
    outstandingBalance: 450.00,
    paymentUrl: "https://lmx8imports.com/portal/payments/shipment-uuid-123",
  });

  assert(htmlUnpaid.includes("ACTION REQUIRED: SHIPPING FEE DUE"), "HTML contains ACTION REQUIRED banner for unpaid fee");
  assert(htmlUnpaid.includes("GHS 450.00"), "HTML displays correct outstanding shipping fee");
  assert(htmlUnpaid.includes("PAY SHIPPING FEE"), "HTML contains Pay Shipping Fee button");
  assert(htmlUnpaid.includes("https://lmx8imports.com/portal/payments/shipment-uuid-123"), "HTML Pay button links to existing customer payment URL");

  // Test 7: Verify HTML Generation for Customs Clearance when Fee is Paid
  const htmlPaid = generateMilestoneEmailHtml({
    customerName: "Kofi Mensah",
    customerIdentifier: "LMX-001",
    batchDisplay: "AIR-CARGO-BATCH-04",
    trackingNumber: "SHP-998822",
    description: "Industrial Electronics & Spares",
    milestone: "CUSTOMS_CLEARANCE",
    statusDate: "Oct 7, 2026",
    portalUrl: "https://lmx8imports.com/portal/shipments/SHP-998822",
    isShippingFeeUnpaid: false,
    totalShippingFee: 450.00,
    amountPaid: 450.00,
    outstandingBalance: 0,
  });

  assert(!htmlPaid.includes("ACTION REQUIRED: SHIPPING FEE DUE"), "HTML has NO action required banner when fee is paid");
  assert(!htmlPaid.includes("PAY SHIPPING FEE"), "HTML has NO payment button when fee is paid");
  assert(htmlPaid.includes("View Full Timeline in Portal"), "HTML displays View Full Timeline in Portal CTA");

  console.log("\nALL 7 TESTS PASSED SUCCESSFULLY! ✓");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});

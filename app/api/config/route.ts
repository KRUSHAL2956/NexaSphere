import { NextResponse } from "next/server";

export const revalidate = 60; // Cache the response for 60 seconds

export async function GET() {
  const config = {
    appName: "NexaSphere",
    version: "1.0.0",
    features: {
      membershipRegistration: true,
      recruitmentForm: true,
      portfolioBuilder: true,
    },
    maintenanceMode: false,
  };

  return NextResponse.json(config);
}

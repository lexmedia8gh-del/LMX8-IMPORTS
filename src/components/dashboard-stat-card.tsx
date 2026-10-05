import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: "up" | "down" | "neutral";
}

export function DashboardStatCard({ title, value, icon, description, trend }: DashboardStatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-300 border-[#E2E8F0] overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-white group-hover:bg-gray-50/50 transition-colors">
        <CardTitle className="text-sm font-medium text-[#64748B]">{title}</CardTitle>
        <div className="text-gray-400 bg-[#F1F5F9] p-2 rounded-full group-hover:text-brand-gold group-hover:bg-yellow-50 transition-colors">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="bg-white group-hover:bg-gray-50/50 transition-colors">
        <div className="text-2xl font-bold text-[#0F172A]">{value}</div>
        {description && (
          <p className={`text-xs mt-1 font-medium ${trend === 'up' ? 'text-brand-success' : trend === 'down' ? 'text-brand-error' : 'text-[#64748B]'}`}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

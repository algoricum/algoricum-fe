"use client";
import { CalendarOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";
import React, { useState } from "react";
import { BOOKING_LINK, TARGET_VALUE } from "./constants";
import { BookingLinkComponentProps } from "./types";
import { colorMapForBookingLinkComponent } from "./utils";

const { Text } = Typography;

export const BookingLinkComponent: React.FC<BookingLinkComponentProps> = ({
  bgColor,
  borderColor,
  textColor,
  hoverBgColor,
  buttonBgColor,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const getColor = (colorName: string) =>
    colorMapForBookingLinkComponent[colorName as keyof typeof colorMapForBookingLinkComponent] || "#16a34a";
  const buttonStyle = {
    backgroundColor: isHovered ? getColor(hoverBgColor) : getColor(buttonBgColor || textColor),
    borderColor: isHovered ? getColor(hoverBgColor) : getColor(buttonBgColor || textColor),
    color: "white",
    fontWeight: "500",
    transition: "all 0.3s ease", // Smooth transition effect
    transform: isHovered ? "translateY(-1px)" : "translateY(0)", // Subtle lift effect
    boxShadow: isHovered ? "0 4px 8px rgba(0,0,0,0.15)" : "0 2px 4px rgba(0,0,0,0.1)",
  };

  return (
    <div className={`mb-6 p-4 rounded-lg mt-6 ${bgColor} border ${borderColor}`}>
      <div className="flex items-start">
        <CalendarOutlined className="mt-1 mr-3" style={{ color: getColor(textColor) }} />
        <div className="flex-1">
          <Text className="text-sm font-medium block mb-2" style={{ color: getColor(textColor) }}>
            Need Help?
          </Text>
          <Text className="text-sm mb-3 block" style={{ color: getColor(textColor) }}>
            Our team can help you set up the integration and configure your workflows.
            <br />
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => window.open(BOOKING_LINK, TARGET_VALUE)}
              className="mt-2"
              style={buttonStyle}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              Book a Support Meeting
            </Button>
          </Text>
        </div>
      </div>
    </div>
  );
};

export default BookingLinkComponent;

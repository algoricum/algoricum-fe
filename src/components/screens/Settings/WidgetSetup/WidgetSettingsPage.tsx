import { ColorConfigurator, WidgetPreview } from "@/components/common";
import { Button } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { Clinic, UpdateClinicProps } from "@/interfaces/services_type";
import { Flex, Form } from "antd";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import SettingsCard from "../SettingsCard";
import { getClinicData } from "@/utils/supabase/clinic-helper";

const WidgetSettingsPage = () => {
  const [form] = Form.useForm();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const primaryColor = Form.useWatch("primary_color", form);
  const fontColor = Form.useWatch("font_color", form);
  useEffect(() => {
    const fetchClinic = async () => {
      const data = await getClinicData();
      setClinic(data);
      setLoading(false);
    };

    fetchClinic();
  }, []);
  useEffect(() => {
    if (clinic?.widget_theme) {
      form.setFieldsValue({
        primary_color: clinic.widget_theme.primary_color || "#4C2EEB",
        font_color: clinic.widget_theme.font_color || "#4C2EEB",
      });
    }
  }, [clinic, form]);

  const onFinish = async (values: any) => {
    if (!clinic?.id) {
      ErrorToast("Clinic information not found");
      return;
    }

    try {
      setLoading(true);

      const updateData: UpdateClinicProps = {
        id: clinic.id,
        widget_theme: {
          ...clinic.widget_theme,
          primary_color: values.primary_color,
          font_color: values.font_color,
        },
      };

      // Update clinic in Supabase and Redux
      // dispatch(updateClinicData(updateData));
      
      SuccessToast("Widget theme updated successfully");
    } catch (error: any) {
      ErrorToast(error.message || "Failed to update widget theme");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex>
      <Flex vertical gap={18} className="bg-white rounded-xl p-3 h-fit" flex={1}>
        <Form
          form={form}
          layout="vertical"
          className="flex flex-col gap-[18px]"
          onFinish={onFinish}
          name="themeForm"
        >
          <SettingsCard title="Widget Appearance">
            <ColorConfigurator fieldName="primary_color" heading="Primary color" description="Main widget color" />
            <ColorConfigurator fieldName="font_color" heading="Font color" description="Text color in widget" />
            <Button loading={loading} htmlType="submit" className="w-full">
              Save Changes
            </Button>
          </SettingsCard>
        </Form>
      </Flex>
      <Flex flex={1} justify="center" className="max-sm:hidden">
        <WidgetPreview primaryColor={primaryColor} />
      </Flex>
    </Flex>
  );
};

export default WidgetSettingsPage;
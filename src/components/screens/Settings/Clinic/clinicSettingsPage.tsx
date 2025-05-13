import { ColorConfigurator, DeleteModal } from "@/components/common";
import { Button, Input, PasswordInput } from "@/components/elements";
import { ErrorToast, SuccessToast } from "@/helpers/toast";
import { CrossIcon, PencilIcon, UploadIcon } from "@/icons";
import { Clinic, UpdateClinicProps, User } from "@/interfaces/services_type";
import { saveClinic, updateClinicData, uploadLogo, useClinic } from "@/redux/accessors/clinic.accessors";
import { getUser } from "@/redux/accessors/user.accessors";
import { createClient } from "@/utils/supabase/client";
import { Flex, Form, Upload, UploadFile } from "antd";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import SettingsCard from "../SettingsCard";
import { getClinicData, getUserData } from "@/services/auth";

const ClinicSettingsPage = () => {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
   const [clinic, setClinic] = useState<Clinic | null>(null);
   const [user, setUser] = useState<User | null>(null);
  const [isUploadHover, setIsUploadHover] = useState<boolean>(false);
  const [isDeleteModal, setIsDeleteModal] = useState<boolean>(false);
  const [editOpenAI, setEditOpenAI] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isLogoChanged, setIsLogoChanged] = useState<boolean>(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const supabase = createClient();
    useEffect(() => {
      const fetchClinic = async () => {
        const data = await getClinicData();
        setClinic(data);
        setLoading(false);
      };
  
      const fetchUser = async () => {
        const data = await getUserData();
        setUser(data);
        setLoading(false);
      };
      
      fetchClinic();
      fetchUser();
    }, []);
  // Check if current user is the owner of the clinic
  useEffect(() => {
    const checkOwnership = async () => {
      if (user && clinic) {
        if (clinic.owner_id === user.id) {
          setIsOwner(true);
        } else {
          // Check for admin role in user_clinic
          const { data, error } = await supabase
            .from('user_clinic')
            .select('role')
            .eq('user_id', user.id)
            .eq('clinic_id', clinic.id)
            .single();

          if (!error && data && data.role === 'admin') {
            setIsOwner(true);
          } else {
            setIsOwner(false);
          }
        }
      }
    };

    checkOwnership();
  }, [user, clinic]);

  const handleCancel = () => {
    setIsDeleteModal(false);
  };

  const handleDeleteClinic = () => {
    setIsDeleteModal(true);
  };


  const handleImageUpload = (file: any) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      ErrorToast("You can only upload image files!");
      return false;
    }

    setIsLogoChanged(true);
    setLogoFile(file);
    return false; // Prevent automatic upload
  };

  const onFinish = async (values: any) => {
    if (!clinic?.id) {
      ErrorToast("Clinic information not found");
      return;
    }

    try {
      setLoading(true);
      let logoUrl = clinic?.logo;

      // Handle logo upload if changed
      if (isLogoChanged && logoFile && user?.id) {
        const logoUrl = await uploadLogo(user.id, logoFile, dispatch);
      }

      // Prepare dashboard theme data
      const { domain, name, openai_api_key, primary_color } = values;

      // Only include API key if it was changed (not asterisks)
      const apiKeyUpdate = !openai_api_key?.includes("*")
        ? { openai_api_key }
        : {};

      // Prepare update data
      const updateData: UpdateClinicProps = {
        id: clinic.id,
        name,
        domain,
        logo: logoUrl,
        dashboard_theme: {
          ...clinic?.dashboard_theme,
          primary_color
        },
        ...apiKeyUpdate
      };

      // Update clinic in Supabase and Redux
      const updatedClinic = await updateClinicData(updateData, dispatch);
      
      SuccessToast("Clinic settings updated successfully");
    } catch (error: any) {
      ErrorToast(error.message || "Failed to update clinic settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinic) {
      // Mask API key if exists
        
      form.setFieldsValue({
        domain: clinic?.domain || '',
        primary_color: clinic?.dashboard_theme?.primary_color || "#4C2EEB",
        name: clinic?.name || ''
      });
    }
  }, [clinic, form]);

  return (
    <Flex vertical gap={18} className="bg-white max-w-[535px] w-full rounded-xl p-3">
      <Form form={form} layout="vertical" className="flex flex-col gap-[18px]" onFinish={onFinish} name="themeForm">
        <Form.Item
          className="bg-Gray100 p-3 rounded-xl w-full"
          name="name"
          label="Your clinic"
          rules={[
            {
              required: true,
              message: "Clinic name is required",
            },
          ]}
        >
          <Input className="!rounded-xl !h-[36px] brand-input" placeholder="Clinic name" />
        </Form.Item>

        <SettingsCard
          title="Import Your Brand"
          description="Give us your web domain and we will import your brand color and logo for you."
        >
          <Form.Item name="domain" label="Enter your website domain">
            <Input className="w-full !rounded-xl !h-[36px] brand-input" placeholder="example.com" />
          </Form.Item>
        </SettingsCard>

        <SettingsCard title="OpenAI API key">
          <Flex gap={12} align="center">
            <Form.Item
              name="openai_api_key"
              className="w-full"
              rules={[
                {
                  required: true,
                  message: "API key is required",
                },
              ]}
            >
              <PasswordInput
                className="w-full !rounded-xl !h-[36px] brand-input"
                placeholder="Enter your OpenAI API Key"
                disabled={!editOpenAI}
              />
            </Form.Item>
            <Button 
              icon={<PencilIcon width={16} height={16} />} 
              className="!min-w-[48px] !h-[36px]"
              onClick={() => setEditOpenAI(!editOpenAI)}
            />
          </Flex>
        </SettingsCard>

        <SettingsCard title="Shared elements">
          <ColorConfigurator fieldName="primary_color" heading="Primary color" description="Applies to all pages" />
          <Form.Item label="Logo" name="logo">
            <Upload
              name="file"
              beforeUpload={handleImageUpload}
              listType="picture"
              maxCount={1}
              showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
              fileList={logoFile ? [
                {
                  uid: '-1',
                  name: logoFile.name,
                  status: 'done',
                  url: URL.createObjectURL(logoFile)
                } as UploadFile
              ] : clinic?.logo ? [
                {
                  uid: '-1',
                  name: 'Current Logo',
                  status: 'done',
                  url: clinic.logo
                } as UploadFile
              ] : []}
              onRemove={() => {
                setLogoFile(null);
                setIsLogoChanged(true);
              }}
            >
              <Button
                onMouseEnter={() => setIsUploadHover(true)}
                onMouseLeave={() => setIsUploadHover(false)}
                className="!bg-white !text-black custom-image-picker"
                icon={<UploadIcon color={isUploadHover ? "white" : "#000000"} width={16} height={13} />}
              >
                Upload an image
              </Button>
            </Upload>
          </Form.Item>
        </SettingsCard>

        <Button loading={loading} htmlType="submit" className="w-full">
          Save Changes
        </Button>

        {isOwner && (
          <Button onClick={handleDeleteClinic} className="w-full" htmlType="button" danger>
            Delete Clinic
          </Button>
        )}
      </Form>
      
    </Flex>
  );
};

export default ClinicSettingsPage;
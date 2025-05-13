// "use client";
// import { Button, Input } from "@/components/elements";
// import { ErrorToast, SuccessToast } from "@/helpers/toast";
// import { getUser } from "@/redux/accessors/user.accessors";
// import { Flex, Form, Typography, Select, Upload } from "antd";
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { UploadOutlined } from '@ant-design/icons';
// import clinicService from "@/services/clinic";
// import apiKeyService from "@/services/apiKey";
// import { CreateClinicProps } from "@/interfaces/services_type";

// const { Title, Text } = Typography;
// const { Option } = Select;

// interface ClinicFormData {
//   name: string;
//   address: string;
//   phone: string;
//   email: string;
//   language: string;
//   logo?: File;
// }

// const ClinicSetupPage = async () => {
//   const router = useRouter();
//   const [form] = Form.useForm();
//   const [loading, setLoading] = useState(false);
//   const user = await getUser();

//   const onFinish = async (values: ClinicFormData) => {
//     if (!user) {
//       ErrorToast("User not found. Please log in again.");
//       return;
//     }

//     setLoading(true);
//     try {
//       // Handle logo upload if provided
//       let logoUrl = undefined;
//       if (values.logo) {
//         logoUrl = await clinicService.uploadLogo(user.id, values.logo as unknown as File);
//       }

//       // Create clinic using the service
//       const clinicData: CreateClinicProps = {
//         name: values.name,
//         address: values.address,
//         phone: values.phone,
//         email: values.email || user.email, // Fixed user.email access
//         language: values.language,
//         owner_id:user.id,
//         logo: logoUrl,
//         widget_theme: {
//           primary_color: "#2563EB",
//           font_family: "Inter, sans-serif",
//           border_radius: "8px"
//         },
//         dashboard_theme: {
//           primary_color: "#2563EB",
//           layout: "sidebar"
//         }
//       };

//       // Create clinic (this will also create the clinic-user relationship as per your updated clinicService)
//       const clinic = await clinicService.create(clinicData);
      
//       // Generate API key for the clinic
//       const apiKeyName = `${values.name} Primary Key`;
//       await apiKeyService.create({
//         name: apiKeyName,
//         clinicId: clinic.id
//       });
//       SuccessToast("Clinic created successfully!");
//       router.push('/dashboard');
//     } catch (error: any) {
//       ErrorToast(error.message || "Failed to create clinic");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <Flex vertical align="center" className="w-full max-w-2xl mx-auto my-10 px-4">
//       <Flex vertical gap={16} className="w-full">
//         <Title level={2}>Set Up Your Clinic</Title>
//         <Text className="text-Gray600">
//           Let's set up your clinic profile. This information will be used throughout Algoricum.
//         </Text>

//         <Form
//           form={form}
//           layout="vertical"
//           className="w-full mt-6"
//           onFinish={onFinish}
//           initialValues={{ language: 'en' }}
//         >
//           <Flex vertical gap={20}>
//             <Form.Item
//               name="name"
//               label="Clinic Name"
//               rules={[{ required: true, message: "Please enter your clinic name" }]}
//             >
//               <Input placeholder="e.g., Glow Dermatology Clinic" />
//             </Form.Item>

//             <Flex gap={16} className="flex-col md:flex-row">
//               <Form.Item
//                 name="phone"
//                 label="Clinic Phone"
//                 className="flex-1"
//                 rules={[{ required: true, message: "Please enter clinic phone number" }]}
//               >
//                 <Input placeholder="+1 (555) 123-4567" />
//               </Form.Item>

//               <Form.Item
//                 name="email"
//                 label="Clinic Email (optional)"
//                 className="flex-1"
//                 rules={[
//                   { 
//                     type: 'email',
//                     message: 'Please enter a valid email address'
//                   }
//                 ]}
//               >
//                 <Input placeholder="contact@yourclinic.com" />
//               </Form.Item>
//             </Flex>

//             <Form.Item
//               name="address"
//               label="Clinic Address"
//               rules={[{ required: true, message: "Please enter clinic address" }]}
//             >
//               <Input placeholder="123 Healthcare Ave, City, State, ZIP" />
//             </Form.Item>

//             <Form.Item
//               name="language"
//               label="Primary Language"
//               rules={[{ required: true, message: "Please select primary language" }]}
//             >
//               <Select placeholder="Select language">
//                 <Option value="en">English</Option>
//                 <Option value="es">Spanish</Option>
//                 <Option value="fr">French</Option>
//               </Select>
//             </Form.Item>

//             <Form.Item
//               name="logo"
//               label="Clinic Logo (optional)"
//               valuePropName="file"
//               getValueFromEvent={(e) => e.file.originFileObj}
//             >
//               <Upload 
//                 name="logo" 
//                 listType="picture"
//                 maxCount={1}
//                 beforeUpload={() => false} // Prevent auto upload
//               >
//                 <Button icon={<UploadOutlined />}>Select Logo</Button>
//               </Upload>
//             </Form.Item>

//             <Form.Item>
//               <Button
//                 loading={loading}
//                 type="primary"
//                 htmlType="submit"
//                 className="w-full mt-4"
//               >
//                 Complete Setup
//               </Button>
//             </Form.Item>
//           </Flex>
//         </Form>
//       </Flex>
//     </Flex>
//   );
// };

// export default ClinicSetupPage;
import { CreateSectionProps } from "@/interfaces/services_type";
import { apiRequest } from "@/utils/apiRequest";
import { sectionRoutes } from "@/utils/routes";

const SectionService = {
  createSection: (data: CreateSectionProps) => {
    return apiRequest({ url: sectionRoutes.createSection, method: "POST", data });
  },
  fetchSections: () => {
    return apiRequest({ url: sectionRoutes.fetchSections, method: "GET" });
  },
  fetchArticleSections: (currentPage: number, pageSize: number) => {
    return apiRequest({ url: sectionRoutes.fetchArticleSections(currentPage, pageSize), method: "GET" });
  },
  editSection: (data: CreateSectionProps, sectionId: string) => {
    return apiRequest({ url: sectionRoutes.editSection(sectionId), method: "put", data });
  },
  deleteSection: (sectionId: string) => {
    return apiRequest({ url: sectionRoutes.deleteSection(sectionId), method: "delete" });
  },
};

export default SectionService;

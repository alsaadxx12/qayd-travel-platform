import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrintTemplatesService {
  constructor(private prisma: PrismaService) {}

  // 1. Get default or active template for a docType
  async getTemplate(companyId: string, docType: string) {
    let template = await this.prisma.printTemplate.findFirst({
      where: { companyId, docType, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!template) {
      template = await this.prisma.printTemplate.findFirst({
        where: { companyId, docType },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!template) {
      return { docType, config: null, isDefault: false, id: null, name: null };
    }

    try {
      return {
        id: template.id,
        name: template.name,
        docType: template.docType,
        isDefault: template.isDefault,
        config: JSON.parse(template.config),
        updatedAt: template.updatedAt,
      };
    } catch {
      return { id: template.id, name: template.name, docType, isDefault: template.isDefault, config: null };
    }
  }

  // 2. Get all default templates mapped by docType (for quick backward compatibility)
  async getAllTemplates(companyId: string) {
    const templates = await this.prisma.printTemplate.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    const result: Record<string, any> = {};
    templates.forEach((t) => {
      // If docType not populated yet or is default, set it
      if (!result[t.docType] || t.isDefault) {
        try {
          result[t.docType] = JSON.parse(t.config);
        } catch {}
      }
    });

    return result;
  }

  // 3. Get list of all saved templates for a specific docType
  async getTemplatesByDocType(companyId: string, docType: string) {
    const templates = await this.prisma.printTemplate.findMany({
      where: { companyId, docType },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return templates.map((t) => {
      let parsedConfig = null;
      try {
        parsedConfig = JSON.parse(t.config);
      } catch {}
      return {
        id: t.id,
        name: t.name || 'تصميم محدد',
        docType: t.docType,
        isDefault: t.isDefault,
        config: parsedConfig,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  }

  // 4. Create new saved print template
  async createTemplate(companyId: string, docType: string, name: string, config: any, isDefault: boolean = false) {
    const jsonConfig = typeof config === 'string' ? config : JSON.stringify(config);

    if (isDefault) {
      await this.prisma.printTemplate.updateMany({
        where: { companyId, docType },
        data: { isDefault: false },
      });
    } else {
      // If no templates exist for this docType, force first template to be default
      const count = await this.prisma.printTemplate.count({
        where: { companyId, docType },
      });
      if (count === 0) {
        isDefault = true;
      }
    }

    const template = await this.prisma.printTemplate.create({
      data: {
        companyId,
        docType,
        name: name || 'تصميم مخصص جديد',
        config: jsonConfig,
        isDefault,
      },
    });

    return {
      success: true,
      id: template.id,
      docType: template.docType,
      name: template.name,
      isDefault: template.isDefault,
      message: 'تم حفظ التصميم الجديد بنجاح في قاعدة البيانات Supabase',
    };
  }

  // 5. Update an existing template
  async updateTemplate(companyId: string, id: string, name?: string, config?: any, isDefault?: boolean) {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException('القالب غير موجود');
    }

    if (isDefault) {
      await this.prisma.printTemplate.updateMany({
        where: { companyId, docType: existing.docType },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (config) updateData.config = typeof config === 'string' ? config : JSON.stringify(config);
    if (typeof isDefault === 'boolean') updateData.isDefault = isDefault;

    const updated = await this.prisma.printTemplate.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      id: updated.id,
      name: updated.name,
      docType: updated.docType,
      isDefault: updated.isDefault,
      message: 'تم تحديث التصميم بنجاح في قاعدة البيانات Supabase',
    };
  }

  // 6. Set template as approved default template
  async setDefaultTemplate(companyId: string, id: string) {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException('القالب غير موجود');
    }

    // Unset default on all templates of same docType
    await this.prisma.printTemplate.updateMany({
      where: { companyId, docType: existing.docType },
      data: { isDefault: false },
    });

    // Set default on this template
    const updated = await this.prisma.printTemplate.update({
      where: { id },
      data: { isDefault: true },
    });

    return {
      success: true,
      id: updated.id,
      docType: updated.docType,
      name: updated.name,
      isDefault: true,
      message: `تم اعتماد تصميم (${updated.name}) كـ تصميم رسمي للكشوفات بنجاح 🌟`,
    };
  }

  // 7. Delete saved template
  async deleteTemplate(companyId: string, id: string) {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundException('القالب غير موجود');
    }

    await this.prisma.printTemplate.delete({
      where: { id },
    });

    // If deleted template was default, make the latest remaining template default
    if (existing.isDefault) {
      const remaining = await this.prisma.printTemplate.findFirst({
        where: { companyId, docType: existing.docType },
        orderBy: { updatedAt: 'desc' },
      });
      if (remaining) {
        await this.prisma.printTemplate.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    return {
      success: true,
      message: 'تم حذف التصميم من قاعدة البيانات بنجاح',
    };
  }

  // Legacy save method wrapper
  async saveTemplate(companyId: string, docType: string, config: any, name?: string) {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { companyId, docType, isDefault: true },
    });

    if (existing) {
      return this.updateTemplate(companyId, existing.id, name || existing.name || undefined, config, true);
    } else {
      return this.createTemplate(companyId, docType, name || 'التصميم الرئيسي المعتمد', config, true);
    }
  }
}


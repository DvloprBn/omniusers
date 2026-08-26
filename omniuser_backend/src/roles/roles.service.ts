import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

/**
 * CRUD real del catálogo de roles dinámicos — el corazón de por qué este
 * proyecto generaliza mejor que un enum fijo (ver `PLAN_DESARROLLO.md` §4,
 * punto 3): un rol nuevo se puede crear sin ningún deploy de código. Lo que
 * SÍ sigue necesitando código es que un endpoint concreto empiece a
 * aceptarlo en su `@Roles(...)` — crear el rol aquí no le da permisos
 * automáticos en ningún lado.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roles.findMany({ orderBy: { name: 'asc' } });
  }

  async findOneOrThrow(roleId: number) {
    const role = await this.prisma.roles.findUnique({ where: { role_id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  async create(dto: CreateRoleDto) {
    try {
      // is_system SIEMPRE false aquí — los roles reales del sistema
      // (admin/super/usuario) solo se marcan is_system:true desde el seed
      // real (prisma/seed.ts), nunca desde este endpoint.
      return await this.prisma.roles.create({ data: { name: dto.name, description: dto.description } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
      throw e;
    }
  }

  /** @throws {BadRequestException} si se intenta renombrar un rol `is_system` (ver el porqué en `UpdateRoleDto`). */
  async update(roleId: number, dto: UpdateRoleDto) {
    const role = await this.findOneOrThrow(roleId);
    if (role.is_system && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Este rol es del sistema — su nombre no se puede cambiar');
    }
    try {
      return await this.prisma.roles.update({ where: { role_id: roleId }, data: { name: dto.name, description: dto.description } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
      throw e;
    }
  }

  /**
   * @throws {BadRequestException} si el rol es `is_system` (nunca se puede borrar, dejaría al sistema sin un rol administrativo real) o si tiene cuentas reales asignadas (borrarlo dejaría esas cuentas sin rol — se les debe reasignar uno antes).
   */
  async remove(roleId: number): Promise<void> {
    const role = await this.prisma.roles.findUnique({ where: { role_id: roleId }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.is_system) {
      throw new BadRequestException('Este rol es del sistema — no se puede borrar');
    }
    if (role._count.users > 0) {
      throw new BadRequestException(`Hay ${role._count.users} cuenta(s) real(es) con este rol — reasígnalas antes de borrarlo`);
    }
    await this.prisma.roles.delete({ where: { role_id: roleId } });
  }
}

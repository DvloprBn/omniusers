import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { welcomeUserEmail } from '../mail/templates/welcome-user.template';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  user_id: true,
  email: true,
  name: true,
  is_active: true,
  must_change_password: true,
  totp_enabled: true,
  created_at: true,
  roles: { select: { role_id: true, name: true } },
} as const;

/** Administración real de cuentas (`admin`/`super`) — crear con cualquier rol, cambiar rol, activar/desactivar. Nunca borra una cuenta (mismo criterio real que los proyectos hermanos: desactivar preserva el historial real, borrar lo destruye). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  findAll() {
    return this.prisma.users.findMany({ select: USER_SELECT, orderBy: { created_at: 'desc' } });
  }

  /**
   * Crea una cuenta con contraseña temporal generada por el sistema (nunca
   * elegida por quien la crea) y manda el correo real de bienvenida. Si el
   * correo falla, la contraseña temporal se regresa en la respuesta — única
   * oportunidad real de que quien creó la cuenta se entere y se la
   * comparta a mano (mismo patrón real ya usado en los hermanos).
   *
   * @throws {ConflictException} si el correo ya está registrado.
   */
  async create(dto: CreateUserDto): Promise<{ user_id: string; email: string; welcome_email_sent: boolean; temp_password?: string }> {
    const existing = await this.prisma.users.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ese correo ya está registrado');

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const created = await this.prisma.users.create({
      data: { email: dto.email, name: dto.name, password_hash: passwordHash, role_id: dto.role_id, must_change_password: true },
    });

    const { subject, html } = welcomeUserEmail({
      name: dto.name ?? null,
      email: dto.email,
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
    });
    const sent = await this.mail.send({ to: dto.email, subject, html });

    return { user_id: created.user_id, email: created.email, welcome_email_sent: sent, temp_password: sent ? undefined : tempPassword };
  }

  /** @throws {NotFoundException} si la cuenta no existe. */
  async update(userId: string, dto: UpdateUserDto) {
    const existing = await this.prisma.users.findUnique({ where: { user_id: userId } });
    if (!existing) throw new NotFoundException('Cuenta no encontrada');

    return this.prisma.users.update({
      where: { user_id: userId },
      data: { role_id: dto.role_id, is_active: dto.is_active },
      select: USER_SELECT,
    });
  }
}

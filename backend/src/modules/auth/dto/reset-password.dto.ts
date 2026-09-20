import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be between 8 and 12 characters long' })
  @MaxLength(12, { message: 'Password must be between 8 and 12 characters long' })
  newPassword: string;
}
